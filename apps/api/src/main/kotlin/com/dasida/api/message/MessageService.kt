package com.dasida.api.message

import com.dasida.api.auth.AuthService
import com.dasida.api.auth.UserBlockService
import com.dasida.api.auth.UserFollowService
import com.dasida.api.auth.UserRepository
import com.dasida.api.common.checkPageParams
import com.dasida.api.notification.NotificationService
import com.dasida.api.notification.NotificationType
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Clock
import java.time.Instant
import java.util.UUID

@Service
class MessageService(
    private val conversations: ConversationRepository,
    private val members: ConversationMemberRepository,
    private val messages: MessageRepository,
    private val users: UserRepository,
    private val authService: AuthService,
    private val userFollowService: UserFollowService,
    private val userBlocks: UserBlockService,
    private val notifications: NotificationService,
    private val clock: Clock,
) {
    @Transactional
    fun findOrCreateConversation(userId: Long, peerUserId: Long): ConversationSummaryResponse {
        if (userId == peerUserId) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "cannot message yourself")
        }
        authService.publicUser(peerUserId)
        val low = minOf(userId, peerUserId)
        val high = maxOf(userId, peerUserId)
        val existing = conversations.findByUserLowIdAndUserHighId(low, high)
        if (existing != null) {
            return toSummary(existing, userId)
        }
        if (userBlocks.isBlockedEitherWay(userId, peerUserId)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "blocked user")
        }
        val now = Instant.now(clock)
        val conversation = conversations.save(
            Conversation(
                id = "conv-${UUID.randomUUID()}",
                userLowId = low,
                userHighId = high,
                lastMessageId = null,
                updatedAt = now,
            ),
        )
        members.save(
            ConversationMember(
                id = "cm-${UUID.randomUUID()}",
                conversationId = conversation.id,
                userId = userId,
                lastReadMessageId = null,
                joinedAt = now,
            ),
        )
        members.save(
            ConversationMember(
                id = "cm-${UUID.randomUUID()}",
                conversationId = conversation.id,
                userId = peerUserId,
                lastReadMessageId = null,
                joinedAt = now,
            ),
        )
        return toSummary(conversation, userId)
    }

    @Transactional(readOnly = true)
    fun getConversation(userId: Long, conversationId: String): ConversationSummaryResponse {
        memberOrForbidden(userId, conversationId)
        val conversation = conversations.findById(conversationId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "conversation not found")
        }
        return toSummary(conversation, userId)
    }

    @Transactional(readOnly = true)
    fun listConversations(userId: Long, page: Int, size: Int): ConversationPageResponse {
        checkPageParams(page, size, MAX_PAGE_SIZE)
        val result = members.findByUserIdOrderByConversationUpdatedAt(
            userId,
            PageRequest.of(page, size),
        )
        return ConversationPageResponse(
            content = result.content.mapNotNull { member ->
                conversations.findById(member.conversationId).orElse(null)?.let { toSummary(it, userId, member) }
            },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    @Transactional(readOnly = true)
    fun unreadCount(userId: Long): ConversationUnreadCountResponse {
        var total = 0
        var page = 0
        while (true) {
            val batch = members.findByUserIdOrderByConversationUpdatedAt(userId, PageRequest.of(page, MAX_PAGE_SIZE))
            total += batch.content.sumOf { unreadForMember(it, userId).toInt() }
            if (!batch.hasNext()) break
            page++
        }
        return ConversationUnreadCountResponse(unreadCount = total)
    }

    @Transactional(readOnly = true)
    fun listMessages(userId: Long, conversationId: String, page: Int, size: Int): MessagePageResponse {
        val member = memberOrForbidden(userId, conversationId)
        checkPageParams(page, size, MAX_PAGE_SIZE)
        val result = messages.findByConversationId(
            conversationId,
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "seq")),
        )
        return MessagePageResponse(
            content = result.content.map { it.toResponse(userId) },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    @Transactional
    fun sendMessage(userId: Long, conversationId: String, content: String): MessageResponse {
        memberOrForbidden(userId, conversationId)
        val conversation = conversations.findById(conversationId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "conversation not found")
        }
        val peerId = peerUserId(conversation, userId)
        if (userBlocks.isBlockedEitherWay(userId, peerId)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "blocked user")
        }
        val trimmed = content.trim()
        if (trimmed.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "content is required")
        }
        if (trimmed.length > MAX_CONTENT) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "content too long")
        }
        val now = Instant.now(clock)
        val message = messages.save(
            Message(
                id = "msg-${UUID.randomUUID()}",
                conversationId = conversationId,
                senderId = userId,
                content = trimmed,
                type = MessageType.TEXT,
                createdAt = now,
                seq = System.nanoTime(),
            ),
        )
        conversation.lastMessageId = message.id
        conversation.updatedAt = now
        conversations.save(conversation)

        val sender = users.findById(userId).orElse(null)
        val preview = trimmed.take(NOTIFICATION_PREVIEW)
        notifications.notify(
            recipientUserId = peerId,
            actorUserId = userId,
            type = NotificationType.MESSAGE_RECEIVED,
            title = "새 메시지",
            body = "${sender?.name ?: "사용자"}: $preview",
            href = "/messages/$conversationId",
        )
        return message.toResponse(userId)
    }

    @Transactional
    fun markRead(userId: Long, conversationId: String): MarkReadResponse {
        val member = memberOrForbidden(userId, conversationId)
        val latest = messages.findFirstByConversationIdOrderBySeqDesc(conversationId)
        if (latest != null) {
            member.lastReadMessageId = latest.id
            members.save(member)
        }
        return MarkReadResponse(read = true)
    }

    private fun memberOrForbidden(userId: Long, conversationId: String): ConversationMember =
        members.findByConversationIdAndUserId(conversationId, userId)
            ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "not a conversation member")

    private fun peerUserId(conversation: Conversation, userId: Long): Long =
        if (conversation.userLowId == userId) conversation.userHighId else conversation.userLowId

    private fun toSummary(
        conversation: Conversation,
        userId: Long,
        member: ConversationMember? = members.findByConversationIdAndUserId(conversation.id, userId),
    ): ConversationSummaryResponse {
        val peerId = peerUserId(conversation, userId)
        val peer = userFollowService.getPublicProfile(peerId, userId)
        val lastMessage = conversation.lastMessageId?.let { id ->
            messages.findById(id).orElse(null)?.let {
                MessagePreview(
                    id = it.id,
                    content = it.content,
                    senderId = it.senderId,
                    createdAt = it.createdAt.toString(),
                )
            }
        }
        val unread = member?.let { unreadForMember(it, userId).toInt() } ?: 0
        return ConversationSummaryResponse(
            id = conversation.id,
            peer = peer,
            lastMessage = lastMessage,
            unreadCount = unread,
            updatedAt = conversation.updatedAt.toString(),
        )
    }

    private fun unreadForMember(member: ConversationMember, userId: Long): Long {
        val afterSeq = member.lastReadMessageId?.let { messages.findById(it).orElse(null)?.seq } ?: -1L
        return messages.countUnreadAfterSeq(member.conversationId, userId, afterSeq)
    }

    private fun Message.toResponse(viewerId: Long) = MessageResponse(
        id = id,
        senderId = senderId,
        content = content,
        createdAt = createdAt.toString(),
        mine = senderId == viewerId,
    )

    private companion object {
        const val MAX_PAGE_SIZE = 100
        const val MAX_CONTENT = 2000
        const val NOTIFICATION_PREVIEW = 50
    }
}

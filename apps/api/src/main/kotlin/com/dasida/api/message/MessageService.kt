package com.dasida.api.message

import com.dasida.api.common.SeqGenerator
import com.dasida.api.auth.AuthService
import com.dasida.api.auth.User
import com.dasida.api.auth.UserBlockService
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
    private val userBlocks: UserBlockService,
    private val notifications: NotificationService,
    private val dmHub: DmSessionHub,
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

    /**
     * 대화방 목록. 대화방별 개별 조회(대화·peer·마지막 메시지·미읽음 = 행당 4+ 쿼리) 대신
     * 페이지 단위 bulk 4쿼리(대화 IN, peer IN, 마지막 메시지 IN, 미읽음 group by)로 구성한다.
     */
    @Transactional(readOnly = true)
    fun listConversations(userId: Long, page: Int, size: Int): ConversationPageResponse {
        checkPageParams(page, size, MAX_PAGE_SIZE)
        val result = members.findByUserIdOrderByConversationUpdatedAt(
            userId,
            PageRequest.of(page, size),
        )
        val conversationById = conversations.findAllById(result.content.map { it.conversationId })
            .associateBy { it.id }
        val pageConversations = result.content.mapNotNull { conversationById[it.conversationId] }
        val peerById = users.findAllById(pageConversations.map { peerUserId(it, userId) }.distinct())
            .filter { it.deletedAt == null }
            .associateBy { requireNotNull(it.id) }
        val lastMessageIds = pageConversations.mapNotNull { it.lastMessageId }
        val lastMessageById =
            if (lastMessageIds.isEmpty()) emptyMap()
            else messages.findAllById(lastMessageIds).associateBy { it.id }
        val unreadByConversation =
            if (pageConversations.isEmpty()) emptyMap()
            else messages.countUnreadByConversation(userId, pageConversations.map { it.id })
                .associate { it.conversationId to it.unread }
        return ConversationPageResponse(
            // 삭제된 대화방·탈퇴한 상대의 orphan 멤버십은 기존과 같이 결과에서 제외한다.
            content = pageConversations.mapNotNull { conversation ->
                val peer = peerById[peerUserId(conversation, userId)] ?: return@mapNotNull null
                buildSummary(
                    conversation,
                    peer = toPeer(peer),
                    lastMessage = conversation.lastMessageId?.let(lastMessageById::get),
                    unread = (unreadByConversation[conversation.id] ?: 0L).toInt(),
                )
            },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    @Transactional(readOnly = true)
    fun unreadCount(userId: Long): ConversationUnreadCountResponse =
        ConversationUnreadCountResponse(unreadCount = messages.countTotalUnreadForUser(userId).toInt())

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
                seq = SeqGenerator.next(),
            ),
        )
        conversation.lastMessageId = message.id
        conversation.updatedAt = now
        conversations.save(conversation)

        val sender = users.findById(userId).orElse(null)
        val preview = trimmed.take(NOTIFICATION_PREVIEW)
        // 수신자가 DM 알림을 꺼뒀으면 알림 row 를 만들지 않는다(대화방 실시간 수신·배지는 WS 가 담당).
        val recipient = users.findById(peerId).orElse(null)
        if (recipient != null && recipient.notifyMessages) {
            notifications.notify(
                recipientUserId = peerId,
                actorUserId = userId,
                type = NotificationType.MESSAGE_RECEIVED,
                title = "새 메시지",
                body = "${sender?.name ?: "사용자"}: $preview",
                href = "/messages/$conversationId",
            )
        }
        dmHub.publishMessage(
            conversationId,
            DmMessagePayload(
                id = message.id,
                senderId = message.senderId,
                content = message.content,
                createdAt = message.createdAt.toString(),
            ),
            excludeUserId = userId,
        )
        notifyInbox(conversation, conversationId)
        return message.toResponse(userId)
    }

    @Transactional
    fun markRead(userId: Long, conversationId: String): MarkReadResponse {
        val member = memberOrForbidden(userId, conversationId)
        val latest = messages.findFirstByConversationIdOrderBySeqDesc(conversationId)
        if (latest != null) {
            member.lastReadMessageId = latest.id
            members.save(member)
            dmHub.publishRead(
                conversationId,
                DmReadPayload(userId = userId, lastReadMessageId = latest.id),
                excludeUserId = userId,
            )
            conversations.findById(conversationId).orElse(null)?.let { notifyInbox(it, conversationId) }
        }
        return MarkReadResponse(read = true)
    }

    private fun memberOrForbidden(userId: Long, conversationId: String): ConversationMember =
        members.findByConversationIdAndUserId(conversationId, userId)
            ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "not a conversation member")

    private fun peerUserId(conversation: Conversation, userId: Long): Long =
        if (conversation.userLowId == userId) conversation.userHighId else conversation.userLowId

    private fun notifyInbox(conversation: Conversation, conversationId: String) {
        for (userId in listOf(conversation.userLowId, conversation.userHighId)) {
            dmHub.publishInbox(
                userId,
                conversationId,
                DmInboxPayload(
                    summary = toSummary(conversation, userId),
                    totalUnread = unreadCount(userId).unreadCount,
                ),
            )
        }
    }

    /** 단일 대화방 요약(생성/단건 조회/WS inbox 용). 목록은 listConversations 의 bulk 경로를 쓴다. */
    private fun toSummary(
        conversation: Conversation,
        userId: Long,
        member: ConversationMember? = members.findByConversationIdAndUserId(conversation.id, userId),
    ): ConversationSummaryResponse {
        val peer = toPeer(authService.publicUser(peerUserId(conversation, userId)))
        val lastMessage = conversation.lastMessageId?.let { messages.findById(it).orElse(null) }
        val unread = member?.let { unreadForMember(it, userId).toInt() } ?: 0
        return buildSummary(conversation, peer, lastMessage, unread)
    }

    private fun buildSummary(
        conversation: Conversation,
        peer: ConversationPeerResponse,
        lastMessage: Message?,
        unread: Int,
    ) = ConversationSummaryResponse(
        id = conversation.id,
        peer = peer,
        lastMessage = lastMessage?.let {
            MessagePreview(
                id = it.id,
                content = it.content,
                senderId = it.senderId,
                createdAt = it.createdAt.toString(),
            )
        },
        unreadCount = unread,
        updatedAt = conversation.updatedAt.toString(),
    )

    private fun toPeer(user: User) = ConversationPeerResponse(
        id = requireNotNull(user.id),
        name = user.name,
        verified = user.verified,
        profileImageUrl = user.profileImageUrl,
    )

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

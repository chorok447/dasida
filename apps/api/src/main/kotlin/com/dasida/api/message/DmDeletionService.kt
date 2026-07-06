package com.dasida.api.message

import com.dasida.api.auth.UserBlockRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class DmDeletionService(
    private val conversations: ConversationRepository,
    private val members: ConversationMemberRepository,
    private val messages: MessageRepository,
    private val blocks: UserBlockRepository,
) {
    @Transactional
    fun deleteAllForUser(userId: Long) {
        val conversationIds = mutableListOf<String>()
        var page = 0
        while (true) {
            val batch = members.findByUserIdOrderByConversationUpdatedAt(userId, PageRequest.of(page, 100))
            conversationIds.addAll(batch.content.map { it.conversationId })
            if (!batch.hasNext()) break
            page++
        }
        messages.deleteAllBySenderId(userId)
        val distinctIds = conversationIds.distinct()
        if (distinctIds.isNotEmpty()) {
            messages.deleteByConversationIds(distinctIds)
        }
        members.deleteAllForUser(userId)
        conversations.deleteAllForUser(userId)
        blocks.deleteAllForUser(userId)
    }
}

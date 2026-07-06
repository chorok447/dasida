package com.dasida.api.message

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface ConversationMemberRepository : JpaRepository<ConversationMember, String> {
    fun findByConversationIdAndUserId(conversationId: String, userId: Long): ConversationMember?

    @Query(
        """
        select cm from ConversationMember cm
        join Conversation c on cm.conversationId = c.id
        where cm.userId = :userId
        order by c.updatedAt desc
        """,
    )
    fun findByUserIdOrderByConversationUpdatedAt(@Param("userId") userId: Long, pageable: Pageable): Page<ConversationMember>

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from ConversationMember cm where cm.userId = :userId")
    fun deleteAllForUser(@Param("userId") userId: Long)

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from ConversationMember cm where cm.conversationId = :conversationId")
    fun deleteByConversationId(@Param("conversationId") conversationId: String)
}

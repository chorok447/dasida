package com.dasida.api.message

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface MessageRepository : JpaRepository<Message, String> {
    fun findByConversationId(conversationId: String, pageable: Pageable): Page<Message>

    fun findFirstByConversationIdOrderBySeqDesc(conversationId: String): Message?

    @Query(
        """
        select count(m) from Message m
        where m.conversationId = :conversationId
          and m.senderId <> :userId
          and m.seq > :afterSeq
        """,
    )
    fun countUnreadAfterSeq(
        @Param("conversationId") conversationId: String,
        @Param("userId") userId: Long,
        @Param("afterSeq") afterSeq: Long,
    ): Long

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from Message m where m.senderId = :userId")
    fun deleteAllBySenderId(@Param("userId") userId: Long)

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from Message m where m.conversationId in :conversationIds")
    fun deleteByConversationIds(@Param("conversationIds") conversationIds: List<String>)
}

package com.dasida.api.message

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

/** countUnreadByConversation JPQL constructor projection 용. */
data class ConversationUnread(val conversationId: String, val unread: Long)

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

    @Query(
        """
        select count(m) from Message m
        join ConversationMember cm on cm.conversationId = m.conversationId and cm.userId = :userId
        left join Message lr on lr.id = cm.lastReadMessageId
        where m.senderId <> :userId
          and m.seq > coalesce(lr.seq, -1)
        """,
    )
    fun countTotalUnreadForUser(@Param("userId") userId: Long): Long

    /** 대화방 목록 페이지용 미읽음 그룹 집계 — 대화방별 2쿼리(lastRead seq + count) N+1 을 대체한다. */
    @Query(
        """
        select new com.dasida.api.message.ConversationUnread(m.conversationId, count(m))
        from Message m
        join ConversationMember cm on cm.conversationId = m.conversationId and cm.userId = :userId
        left join Message lr on lr.id = cm.lastReadMessageId
        where m.senderId <> :userId
          and m.seq > coalesce(lr.seq, -1)
          and m.conversationId in :conversationIds
        group by m.conversationId
        """,
    )
    fun countUnreadByConversation(
        @Param("userId") userId: Long,
        @Param("conversationIds") conversationIds: Collection<String>,
    ): List<ConversationUnread>

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from Message m where m.senderId = :userId")
    fun deleteAllBySenderId(@Param("userId") userId: Long)

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from Message m where m.conversationId in :conversationIds")
    fun deleteByConversationIds(@Param("conversationIds") conversationIds: List<String>)
}

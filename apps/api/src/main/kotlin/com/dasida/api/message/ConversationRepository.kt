package com.dasida.api.message

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface ConversationRepository : JpaRepository<Conversation, String> {
    fun findByUserLowIdAndUserHighId(userLowId: Long, userHighId: Long): Conversation?

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        """
        delete from Conversation c
        where c.userLowId = :userId or c.userHighId = :userId
        """,
    )
    fun deleteAllForUser(@Param("userId") userId: Long)
}

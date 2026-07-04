package com.dasida.api.auth

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import java.time.Instant

interface UserAccessLogRepository : JpaRepository<UserAccessLog, Long> {
    fun findByUserIdAndAccessedAtAfterOrderByAccessedAtDesc(
        userId: Long,
        accessedAt: Instant,
        pageable: Pageable,
    ): Page<UserAccessLog>

    @Modifying
    fun deleteByUserId(userId: Long)

    @Modifying
    @Query("DELETE FROM UserAccessLog l WHERE l.accessedAt < :before")
    fun deleteByAccessedAtBefore(before: Instant): Int
}

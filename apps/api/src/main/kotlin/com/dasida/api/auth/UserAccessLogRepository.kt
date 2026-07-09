package com.dasida.api.auth

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Transactional
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

    // 트랜잭션 밖(geo 보강 executor)에서 호출되므로 자체 트랜잭션을 연다.
    @Transactional
    @Modifying
    @Query("UPDATE UserAccessLog l SET l.country = :country, l.region = :region WHERE l.id = :id")
    fun updateLocation(id: Long, country: String, region: String?): Int
}

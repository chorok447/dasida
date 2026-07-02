package com.dasida.api.notification

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

interface NotificationRepository : JpaRepository<Notification, String> {
    fun findByUserId(userId: Long, pageable: Pageable): Page<Notification>
    fun findByUserIdAndReadAtIsNull(userId: Long, pageable: Pageable): Page<Notification>
    fun countByUserIdAndReadAtIsNull(userId: Long): Long
    fun findByIdAndUserId(id: String, userId: Long): Notification?

    @Modifying
    @Query("update Notification n set n.readAt = :readAt where n.userId = :userId and n.readAt is null")
    fun markAllRead(@Param("userId") userId: Long, @Param("readAt") readAt: Instant): Int

    @Modifying
    @Query("delete from Notification n where n.userId = :userId and n.readAt is not null")
    fun deleteReadByUserId(@Param("userId") userId: Long): Int
}

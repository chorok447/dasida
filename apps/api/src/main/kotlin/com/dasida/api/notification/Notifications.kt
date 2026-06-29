package com.dasida.api.notification

import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import com.dasida.api.security.AuthUser
import java.time.Instant
import java.util.UUID

/** 알림 타입. 이번 PR 범위. */
object NotificationType {
    const val POST_COMMENT_CREATED = "POST_COMMENT_CREATED"
    const val CAMPAIGN_COMMENT_CREATED = "CAMPAIGN_COMMENT_CREATED"
    const val CAMPAIGN_JOINED = "CAMPAIGN_JOINED"
}

/**
 * 사용자별 알림. userId 는 수신자이며 응답에 노출하지 않는다(@JsonIgnore).
 * 정렬은 seq DESC, id ASC. readAt == null 이면 unread.
 */
@Entity
@Table(
    name = "notifications",
    indexes = [
        Index(name = "idx_notifications_user_read_seq", columnList = "user_id, read_at, seq"),
        Index(name = "idx_notifications_user_seq", columnList = "user_id, seq"),
    ],
)
class Notification(
    @Id val id: String,
    @Column(name = "user_id", nullable = false) @JsonIgnore val userId: Long,
    @Column(nullable = false) val type: String,
    @Column(nullable = false) val title: String,
    @Column(nullable = false, columnDefinition = "TEXT") val body: String,
    @Column(nullable = false) val href: String,
    @Column(name = "read_at") var readAt: Instant?,
    @Column(name = "created_at", nullable = false) val createdAt: Instant,
    // 작성 시점 표시 스냅샷. 프론트는 createdAt 으로 상대시간을 만들고 이 값은 fallback.
    @Column(nullable = false) val time: String,
    @JsonIgnore val seq: Long,
)

interface NotificationRepository : JpaRepository<Notification, String> {
    fun findByUserId(userId: Long, pageable: Pageable): Page<Notification>
    fun findByUserIdAndReadAtIsNull(userId: Long, pageable: Pageable): Page<Notification>
    fun countByUserIdAndReadAtIsNull(userId: Long): Long
    fun findByIdAndUserId(id: String, userId: Long): Notification?

    @Modifying
    @Query("update Notification n set n.readAt = :readAt where n.userId = :userId and n.readAt is null")
    fun markAllRead(@Param("userId") userId: Long, @Param("readAt") readAt: Instant): Int
}

data class NotificationResponse(
    val id: String,
    val type: String,
    val title: String,
    val body: String,
    val href: String,
    val read: Boolean,
    val readAt: Instant?,
    val createdAt: Instant?,
    val time: String,
)

data class NotificationsResponse(
    val content: List<NotificationResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
    val unreadCount: Long,
)

data class NotificationUnreadCountResponse(val unreadCount: Long)

data class NotificationReadAllResponse(val updatedCount: Long, val unreadCount: Long)

fun Notification.toResponse() = NotificationResponse(
    id = id,
    type = type,
    title = title,
    body = body,
    href = href,
    read = readAt != null,
    readAt = readAt,
    createdAt = createdAt,
    time = time,
)

/**
 * 알림 생성 helper. 도메인 이벤트(댓글/참여) 트랜잭션 안에서 호출되어 같은 트랜잭션에 참여한다.
 * 수신자가 없거나 actor==receiver 이면 생성하지 않는다. 그 외에는 저장하며, DB 제약 위반은 삼키지 않는다.
 */
@Service
class NotificationService(private val repo: NotificationRepository) {
    fun notify(
        recipientUserId: Long?,
        actorUserId: Long,
        type: String,
        title: String,
        body: String,
        href: String,
    ) {
        if (recipientUserId == null || recipientUserId == actorUserId) return
        val now = Instant.now()
        repo.save(
            Notification(
                id = "noti-${UUID.randomUUID()}",
                userId = recipientUserId,
                type = type,
                title = title,
                body = body.trim().take(MAX_BODY),
                href = href,
                readAt = null,
                createdAt = now,
                time = "방금 전",
                seq = System.nanoTime(),
            ),
        )
    }

    private companion object {
        const val MAX_BODY = 200
    }
}

@RestController
@RequestMapping("/api/notifications")
class NotificationController(private val repo: NotificationRepository) {

    @GetMapping
    @Transactional(readOnly = true)
    fun list(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @RequestParam(defaultValue = "false") unreadOnly: Boolean,
        @AuthenticationPrincipal user: AuthUser,
    ): NotificationsResponse {
        if (page < 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "page must not be negative")
        if (size !in 1..MAX_PAGE_SIZE) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be between 1 and $MAX_PAGE_SIZE")
        }
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Order.desc("seq"), Sort.Order.asc("id")))
        val result = if (unreadOnly) {
            repo.findByUserIdAndReadAtIsNull(user.id, pageable)
        } else {
            repo.findByUserId(user.id, pageable)
        }
        return NotificationsResponse(
            content = result.content.map { it.toResponse() },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
            unreadCount = repo.countByUserIdAndReadAtIsNull(user.id),
        )
    }

    @GetMapping("/unread-count")
    @Transactional(readOnly = true)
    fun unreadCount(@AuthenticationPrincipal user: AuthUser): NotificationUnreadCountResponse =
        NotificationUnreadCountResponse(repo.countByUserIdAndReadAtIsNull(user.id))

    @PostMapping("/{id}/read")
    @Transactional
    fun read(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): NotificationResponse {
        val notification = repo.findByIdAndUserId(id, user.id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "notification $id not found")
        if (notification.readAt == null) notification.readAt = Instant.now()
        return notification.toResponse()
    }

    @PostMapping("/read-all")
    @Transactional
    fun readAll(@AuthenticationPrincipal user: AuthUser): NotificationReadAllResponse {
        val updated = repo.markAllRead(user.id, Instant.now())
        return NotificationReadAllResponse(updatedCount = updated.toLong(), unreadCount = 0)
    }

    private companion object {
        const val MAX_PAGE_SIZE = 100
    }
}

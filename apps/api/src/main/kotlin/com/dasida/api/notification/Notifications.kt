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
import org.springframework.web.bind.annotation.DeleteMapping
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
    const val CAMPAIGN_PARTICIPATION_REMOVED = "CAMPAIGN_PARTICIPATION_REMOVED"
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

    @Modifying
    @Query("delete from Notification n where n.userId = :userId and n.readAt is not null")
    fun deleteReadByUserId(@Param("userId") userId: Long): Int
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

data class NotificationDeleteResponse(val deleted: Boolean, val unreadCount: Long)

data class NotificationDeleteReadResponse(val deletedCount: Long, val unreadCount: Long)

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
 * 알림 도메인 서비스. 두 가지 책임을 가진다.
 * 1) 도메인 이벤트(댓글/참여)에서 호출되는 알림 생성 helper. 호출자 트랜잭션에 참여한다(notify/notifyUser).
 * 2) 알림 조회/읽음/삭제 비즈니스 정책. Controller 에서 옮겨온 검증·트랜잭션·소유권 확인을 담당한다.
 */
@Service
class NotificationService(private val repo: NotificationRepository) {

    @Transactional(readOnly = true)
    fun getNotifications(userId: Long, page: Int, size: Int, unreadOnly: Boolean): NotificationsResponse {
        validatePageable(page, size)
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Order.desc("seq"), Sort.Order.asc("id")))
        val result = if (unreadOnly) {
            repo.findByUserIdAndReadAtIsNull(userId, pageable)
        } else {
            repo.findByUserId(userId, pageable)
        }
        return NotificationsResponse(
            content = result.content.map { it.toResponse() },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
            unreadCount = repo.countByUserIdAndReadAtIsNull(userId),
        )
    }

    @Transactional(readOnly = true)
    fun getUnreadCount(userId: Long): NotificationUnreadCountResponse =
        NotificationUnreadCountResponse(repo.countByUserIdAndReadAtIsNull(userId))

    @Transactional
    fun markAsRead(userId: Long, notificationId: String): NotificationResponse {
        val notification = ownedOrNotFound(userId, notificationId)
        if (notification.readAt == null) notification.readAt = Instant.now()
        return notification.toResponse()
    }

    @Transactional
    fun markAllAsRead(userId: Long): NotificationReadAllResponse {
        val updated = repo.markAllRead(userId, Instant.now())
        return NotificationReadAllResponse(updatedCount = updated.toLong(), unreadCount = 0)
    }

    @Transactional
    fun deleteNotification(userId: Long, notificationId: String): NotificationDeleteResponse {
        repo.delete(ownedOrNotFound(userId, notificationId))
        return NotificationDeleteResponse(deleted = true, unreadCount = repo.countByUserIdAndReadAtIsNull(userId))
    }

    @Transactional
    fun deleteReadNotifications(userId: Long): NotificationDeleteReadResponse {
        val deleted = repo.deleteReadByUserId(userId)
        return NotificationDeleteReadResponse(
            deletedCount = deleted.toLong(),
            unreadCount = repo.countByUserIdAndReadAtIsNull(userId),
        )
    }

    private fun ownedOrNotFound(userId: Long, notificationId: String): Notification =
        repo.findByIdAndUserId(notificationId, userId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "notification $notificationId not found")

    private fun validatePageable(page: Int, size: Int) {
        if (page < 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "page must not be negative")
        if (size !in 1..MAX_PAGE_SIZE) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be between 1 and $MAX_PAGE_SIZE")
        }
    }

    fun notify(
        recipientUserId: Long?,
        actorUserId: Long,
        type: String,
        title: String,
        body: String,
        href: String,
    ) {
        if (recipientUserId == null || recipientUserId == actorUserId) return
        notifyUser(recipientUserId, type, title, body, href)
    }

    /**
     * 수신자에게 직접 알림 생성(actor==receiver 여부와 무관). 강제 퇴장처럼 본인에게도 알려야 하는 경우에 쓴다.
     * 같은 트랜잭션에 참여하며 DB 제약 위반은 삼키지 않는다.
     */
    fun notifyUser(
        recipientUserId: Long,
        type: String,
        title: String,
        body: String,
        href: String,
    ) {
        repo.save(
            Notification(
                id = "noti-${UUID.randomUUID()}",
                userId = recipientUserId,
                type = type,
                title = title,
                body = body.trim().take(MAX_BODY),
                href = href,
                readAt = null,
                createdAt = Instant.now(),
                time = "방금 전",
                seq = System.nanoTime(),
            ),
        )
    }

    private companion object {
        const val MAX_BODY = 200
        const val MAX_PAGE_SIZE = 100
    }
}

/** HTTP adapter. 인증 사용자 추출 후 Service 위임과 status code 반환만 담당한다. */
@RestController
@RequestMapping("/api/notifications")
class NotificationController(private val service: NotificationService) {

    @GetMapping
    fun list(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @RequestParam(defaultValue = "false") unreadOnly: Boolean,
        @AuthenticationPrincipal user: AuthUser,
    ): NotificationsResponse = service.getNotifications(user.id, page, size, unreadOnly)

    @GetMapping("/unread-count")
    fun unreadCount(@AuthenticationPrincipal user: AuthUser): NotificationUnreadCountResponse =
        service.getUnreadCount(user.id)

    @PostMapping("/{id}/read")
    fun read(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): NotificationResponse =
        service.markAsRead(user.id, id)

    @PostMapping("/read-all")
    fun readAll(@AuthenticationPrincipal user: AuthUser): NotificationReadAllResponse =
        service.markAllAsRead(user.id)

    @DeleteMapping("/read")
    fun deleteRead(@AuthenticationPrincipal user: AuthUser): NotificationDeleteReadResponse =
        service.deleteReadNotifications(user.id)

    @DeleteMapping("/{id}")
    fun delete(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): NotificationDeleteResponse =
        service.deleteNotification(user.id, id)
}

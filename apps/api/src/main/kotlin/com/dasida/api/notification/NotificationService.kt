package com.dasida.api.notification

import com.dasida.api.common.checkPageParams
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Instant
import java.util.UUID

/**
 * 알림 도메인 서비스. 두 가지 책임을 가진다.
 * 1) 도메인 이벤트(댓글/참여)에서 호출되는 알림 생성 helper. 호출자 트랜잭션에 참여한다(notify/notifyUser).
 * 2) 알림 조회/읽음/삭제 비즈니스 정책. Controller 에서 옮겨온 검증·트랜잭션·소유권 확인을 담당한다.
 */
@Service
class NotificationService(private val repo: NotificationRepository) {

    @Transactional(readOnly = true)
    fun getNotifications(
        userId: Long,
        page: Int,
        size: Int,
        unreadOnly: Boolean,
        types: List<String> = emptyList(),
    ): NotificationsResponse {
        validatePageable(page, size)
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Order.desc("seq"), Sort.Order.asc("id")))
        val result = when {
            types.isNotEmpty() -> repo.findByUserIdAndTypeIn(userId, types, pageable)
            unreadOnly -> repo.findByUserIdAndReadAtIsNull(userId, pageable)
            else -> repo.findByUserId(userId, pageable)
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

    private fun validatePageable(page: Int, size: Int) = checkPageParams(page, size, MAX_PAGE_SIZE)

    /**
     * 알림 생성 helper. 도메인 이벤트(댓글/참여) 트랜잭션 안에서 호출되어 같은 트랜잭션에 참여한다.
     * 수신자가 없거나 actor==receiver 이면 생성하지 않는다. 그 외에는 저장하며, DB 제약 위반은 삼키지 않는다.
     */
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

package com.dasida.api.notification

import com.dasida.api.security.AuthUser
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

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

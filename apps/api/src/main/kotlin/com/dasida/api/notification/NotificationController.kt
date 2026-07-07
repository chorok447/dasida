package com.dasida.api.notification

import com.dasida.api.security.AuthUser
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
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
@Tag(name = "Notifications", description = "사용자 알림 API")
@SecurityRequirement(name = "bearerAuth")
class NotificationController(private val service: NotificationService) {

    @Operation(summary = "내 알림 목록 조회")
    @GetMapping
    fun list(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @RequestParam(defaultValue = "false") unreadOnly: Boolean,
        @RequestParam(required = false) types: List<String>?,
        @AuthenticationPrincipal user: AuthUser,
    ): NotificationsResponse = service.getNotifications(user.id, page, size, unreadOnly, types ?: emptyList())

    @Operation(summary = "읽지 않은 알림 수 조회")
    @GetMapping("/unread-count")
    fun unreadCount(@AuthenticationPrincipal user: AuthUser): NotificationUnreadCountResponse =
        service.getUnreadCount(user.id)

    @Operation(summary = "알림 읽음 처리")
    @PostMapping("/{id}/read")
    fun read(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): NotificationResponse =
        service.markAsRead(user.id, id)

    @Operation(summary = "모든 알림 읽음 처리")
    @PostMapping("/read-all")
    fun readAll(@AuthenticationPrincipal user: AuthUser): NotificationReadAllResponse =
        service.markAllAsRead(user.id)

    @Operation(summary = "읽은 알림 전체 삭제")
    @DeleteMapping("/read")
    fun deleteRead(@AuthenticationPrincipal user: AuthUser): NotificationDeleteReadResponse =
        service.deleteReadNotifications(user.id)

    @Operation(summary = "알림 삭제")
    @DeleteMapping("/{id}")
    fun delete(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): NotificationDeleteResponse =
        service.deleteNotification(user.id, id)
}

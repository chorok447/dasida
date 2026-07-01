package com.dasida.api.notification

import java.time.Instant

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

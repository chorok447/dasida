package com.dasida.api.notification

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

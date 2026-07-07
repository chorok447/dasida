package com.dasida.api.message

/** WebSocket으로 브로드캐스트하는 중립 메시지(mine 없음 — 수신자가 senderId로 판단). */
data class DmMessagePayload(
    val id: String,
    val senderId: Long,
    val content: String,
    val createdAt: String,
)

data class DmReadPayload(
    val userId: Long,
    val lastReadMessageId: String?,
)

data class DmTypingPayload(
    val userId: Long,
    val active: Boolean,
)

data class DmPresencePayload(
    val userId: Long,
    val online: Boolean,
)

/** inbox WS payload — 목록 행 + 헤더 배지용 전체 unread. */
data class DmInboxPayload(
    val summary: ConversationSummaryResponse,
    val totalUnread: Int,
)

package com.dasida.api.message

/** WebSocket으로 브로드캐스트하는 중립 메시지(mine 없음 — 수신자가 senderId로 판단). */
data class DmMessagePayload(
    val id: String,
    val senderId: Long,
    val content: String,
    val createdAt: String,
)

/** 메시지 삭제 브로드캐스트 — 수신자는 해당 메시지를 마스킹 표시로 바꾼다. */
data class DmMessageDeletedPayload(
    val id: String,
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

/** 알림 생성 시 헤더 배지 갱신용. DM 채널에 실어 보내지만 대화와 무관한 사용자 단위 이벤트다. */
data class DmNotificationPayload(
    val unreadCount: Long,
)

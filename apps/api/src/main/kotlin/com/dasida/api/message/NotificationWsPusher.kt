package com.dasida.api.message

import com.dasida.api.notification.NotificationCreatedEvent
import com.dasida.api.notification.NotificationRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

/**
 * 알림 생성 이벤트를 WS 배지 갱신으로 변환한다. 커밋 후(AFTER_COMMIT)에만 push 하므로
 * 롤백된 알림이 배지로 새지 않고, count 도 커밋된 row 기준으로 정확하다.
 * 수신자가 접속 중이 아니면 hub 가 조용히 무시한다(부담 없음).
 */
@Component
class NotificationWsPusher(
    private val hub: DmSessionHub,
    private val notifications: NotificationRepository,
) {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    fun onNotificationCreated(event: NotificationCreatedEvent) {
        val unread = notifications.countByUserIdAndReadAtIsNull(event.recipientUserId)
        hub.publishNotification(event.recipientUserId, DmNotificationPayload(unread))
    }
}

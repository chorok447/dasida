package com.dasida.api.message

import com.dasida.api.notification.NotificationCreatedEvent
import com.dasida.api.notification.NotificationRepository
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.assertj.core.api.Assertions.assertThat
import tools.jackson.databind.json.JsonMapper

class NotificationWsPusherTest {
    @Test
    fun `알림 생성 이벤트를 받으면 미읽음 수를 담아 수신자 세션에 push 한다`() {
        val hub = DmSessionHub(JsonMapper())
        val session = Mockito.mock(WebSocketSession::class.java)
        Mockito.`when`(session.id).thenReturn("s-1")
        Mockito.`when`(session.isOpen).thenReturn(true)
        hub.register(session, 2L)
        val notifications = Mockito.mock(NotificationRepository::class.java)
        Mockito.`when`(notifications.countByUserIdAndReadAtIsNull(2L)).thenReturn(3L)

        NotificationWsPusher(hub, notifications).onNotificationCreated(NotificationCreatedEvent(2L))

        val captor = ArgumentCaptor.forClass(TextMessage::class.java)
        Mockito.verify(session).sendMessage(captor.capture())
        assertThat(captor.value.payload)
            .contains("\"type\":\"notification\"")
            .contains("\"unreadCount\":3")
    }
}

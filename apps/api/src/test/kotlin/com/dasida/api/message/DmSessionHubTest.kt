package com.dasida.api.message

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import tools.jackson.databind.json.JsonMapper

class DmSessionHubTest {
    private val hub = DmSessionHub(JsonMapper())

    @Test
    fun `구독한 세션에만 메시지를 브로드캐스트한다`() {
        val sender = mockSession("s-sender")
        val recipient = mockSession("s-recipient")
        hub.register(sender, 1L)
        hub.register(recipient, 2L)
        hub.subscribe(recipient, "conv-1")

        hub.publishMessage(
            "conv-1",
            DmMessagePayload("msg-1", 1L, "hi", "2026-01-01T00:00:00Z"),
            excludeUserId = 1L,
        )

        Mockito.verify(recipient).sendMessage(Mockito.any(TextMessage::class.java))
        Mockito.verify(sender, Mockito.never()).sendMessage(Mockito.any(TextMessage::class.java))
        assertEquals(1, hub.subscriberCount("conv-1"))
    }

    private fun mockSession(id: String): WebSocketSession {
        val session = Mockito.mock(WebSocketSession::class.java)
        Mockito.`when`(session.id).thenReturn(id)
        Mockito.`when`(session.isOpen).thenReturn(true)
        return session
    }
}

package com.dasida.api.message

import com.dasida.api.auth.PublicUserResponse
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import tools.jackson.databind.json.JsonMapper

class DmSessionHubTest {
    private val hub = DmSessionHub(JsonMapper())

    private val sampleSummary = ConversationSummaryResponse(
        id = "conv-1",
        peer = PublicUserResponse(id = 2L, name = "Bob", verified = false, postCount = 0),
        lastMessage = MessagePreview("msg-1", "hi", 1L, "2026-01-01T00:00:00Z"),
        unreadCount = 1,
        updatedAt = "2026-01-01T00:00:00Z",
    )

    private val sampleInbox = DmInboxPayload(summary = sampleSummary, totalUnread = 3)

    @Test
    fun `inbox 이벤트는 구독 없이 해당 사용자 세션에 summary 와 totalUnread 를 담아 전달한다`() {
        val a = mockSession("s-a")
        val b = mockSession("s-b")
        hub.register(a, 1L)
        hub.register(b, 2L)

        hub.publishInbox(2L, "conv-1", sampleInbox)

        Mockito.verify(b).sendMessage(Mockito.any(TextMessage::class.java))
        Mockito.verify(a, Mockito.never()).sendMessage(Mockito.any(TextMessage::class.java))
    }

    @Test
    fun `relay inbox 는 로컬 세션에만 전달한다`() {
        val b = mockSession("s-b")
        hub.register(b, 2L)

        hub.deliverFromRelay(
            DmRelayEnvelope(
                origin = "other-instance",
                kind = "inbox",
                userId = 2L,
                conversationId = "conv-1",
                payload = sampleInbox,
            ),
        )

        Mockito.verify(b).sendMessage(Mockito.any(TextMessage::class.java))
    }

    @Test
    fun `notification 이벤트는 구독 없이 해당 사용자 세션에만 전달한다`() {
        val a = mockSession("s-a")
        val b = mockSession("s-b")
        hub.register(a, 1L)
        hub.register(b, 2L)

        hub.publishNotification(2L, DmNotificationPayload(unreadCount = 5))

        Mockito.verify(b).sendMessage(Mockito.any(TextMessage::class.java))
        Mockito.verify(a, Mockito.never()).sendMessage(Mockito.any(TextMessage::class.java))
    }

    @Test
    fun `relay notification 은 로컬 세션에만 전달한다`() {
        val b = mockSession("s-b")
        hub.register(b, 2L)

        hub.deliverFromRelay(
            DmRelayEnvelope(
                origin = "other-instance",
                kind = "notification",
                userId = 2L,
                conversationId = "",
                payload = mapOf("unreadCount" to 5),
            ),
        )

        Mockito.verify(b).sendMessage(Mockito.any(TextMessage::class.java))
    }

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

package com.dasida.api.message

import com.dasida.api.auth.PublicUserResponse
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.mockito.Mockito
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.data.redis.connection.MessageListener
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.listener.ChannelTopic
import org.springframework.data.redis.listener.RedisMessageListenerContainer
import org.springframework.test.context.ActiveProfiles
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import tools.jackson.databind.json.JsonMapper
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * DM WS Redis fan-out smoke test.
 * CI 기본 run 은 Redis 없음 → 비활성. compose Redis 기동 후:
 * `REDIS_SMOKE=true ./gradlew test --tests DmWsFanoutRedisTest`
 */
@SpringBootTest
@ActiveProfiles("local")
@EnabledIfEnvironmentVariable(named = "REDIS_SMOKE", matches = "true")
class DmWsFanoutRedisTest(
    @param:Autowired private val redis: StringRedisTemplate,
    @param:Autowired private val mapper: JsonMapper,
) {
    @Test
    fun `redis relay delivers inbox to remote hub`() {
        val remoteHub = DmSessionHub(mapper)
        val remoteSession = Mockito.mock(WebSocketSession::class.java)
        Mockito.`when`(remoteSession.id).thenReturn("remote-session")
        Mockito.`when`(remoteSession.isOpen).thenReturn(true)
        remoteHub.register(remoteSession, 2L)

        val latch = CountDownLatch(1)
        val container = RedisMessageListenerContainer().apply {
            setConnectionFactory(redis.connectionFactory!!)
            addMessageListener(
                MessageListener { message, _ ->
                    val envelope = mapper.readValue(message.body, DmRelayEnvelope::class.java)
                    if (envelope.origin == "test-publisher") return@MessageListener
                    remoteHub.deliverFromRelay(envelope)
                    latch.countDown()
                },
                ChannelTopic(DmWsFanout.CHANNEL),
            )
            afterPropertiesSet()
            start()
        }

        try {
            val inbox = DmInboxPayload(
                summary = ConversationSummaryResponse(
                    id = "conv-redis",
                    peer = PublicUserResponse(id = 1L, name = "Alice", verified = false, postCount = 0),
                    lastMessage = MessagePreview("msg-r", "ping", 1L, "2026-01-01T00:00:00Z"),
                    unreadCount = 1,
                    updatedAt = "2026-01-01T00:00:00Z",
                ),
                totalUnread = 1,
            )
            val envelope = DmRelayEnvelope(
                origin = "test-publisher",
                kind = "inbox",
                userId = 2L,
                conversationId = "conv-redis",
                payload = inbox,
            )
            redis.convertAndSend(DmWsFanout.CHANNEL, mapper.writeValueAsString(envelope))

            org.assertj.core.api.Assertions.assertThat(latch.await(5, TimeUnit.SECONDS)).isTrue
            Mockito.verify(remoteSession).sendMessage(Mockito.any(TextMessage::class.java))
        } finally {
            container.stop()
        }
    }
}

package com.dasida.api.message

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Lazy
import org.springframework.data.redis.connection.Message
import org.springframework.data.redis.connection.MessageListener
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.listener.ChannelTopic
import org.springframework.data.redis.listener.RedisMessageListenerContainer
import org.springframework.stereotype.Component
import tools.jackson.databind.json.JsonMapper
import java.util.UUID

/** ponytail: Redis pub/sub — 다중 API replica 간 WS 이벤트 fan-out. local(compose) 에서만 활성. */
@Component
@ConditionalOnProperty(prefix = "app.dm.ws", name = ["fanout"], havingValue = "redis")
class DmWsFanout(
    private val redis: StringRedisTemplate,
    private val mapper: JsonMapper,
    @Lazy private val hub: DmSessionHub,
) : MessageListener, AutoCloseable {
    private val instanceId = UUID.randomUUID().toString()
    private val container = RedisMessageListenerContainer().apply {
        setConnectionFactory(redis.connectionFactory!!)
        addMessageListener(this@DmWsFanout, ChannelTopic(CHANNEL))
        afterPropertiesSet()
        start()
    }

    fun relay(envelope: DmRelayEnvelope) {
        // ponytail: Redis 실패해도 로컬 WS·DB 트랜잭션은 유지 (side-channel fan-out)
        runCatching {
            redis.convertAndSend(CHANNEL, mapper.writeValueAsString(envelope.copy(origin = instanceId)))
        }
    }

    override fun onMessage(message: Message, pattern: ByteArray?) {
        val envelope = runCatching {
            mapper.readValue(message.body, DmRelayEnvelope::class.java)
        }.getOrNull() ?: return
        if (envelope.origin == instanceId) return
        hub.deliverFromRelay(envelope)
    }

    override fun close() {
        container.stop()
    }

    companion object {
        const val CHANNEL = "dasida:dm:ws"
    }
}

data class DmRelayEnvelope(
    val origin: String = "",
    val kind: String,
    val userId: Long? = null,
    val conversationId: String,
    val eventType: String? = null,
    val payload: Any? = null,
    val excludeUserId: Long? = null,
)

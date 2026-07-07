package com.dasida.api.message

import org.springframework.stereotype.Component
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import tools.jackson.databind.json.JsonMapper
import java.util.concurrent.ConcurrentHashMap

/**
 * JVM 내 WebSocket 세션 허브.
 * ponytail: 단일 인스턴스 in-memory. 다중 replica 시 Redis pub/sub 브로드캐스트로 교체.
 */
@Component
class DmSessionHub(private val mapper: JsonMapper) {
    private data class Conn(
        val session: WebSocketSession,
        val userId: Long,
        val conversationIds: MutableSet<String> = mutableSetOf(),
    )

    private val conns = ConcurrentHashMap<String, Conn>()

    fun register(session: WebSocketSession, userId: Long) {
        conns[session.id] = Conn(session, userId)
    }

    fun unregister(session: WebSocketSession) {
        val conn = conns.remove(session.id) ?: return
        conn.conversationIds.forEach { convId ->
            notifyPresence(convId, conn.userId, online = false, excludeSessionId = session.id)
        }
    }

    fun subscribe(session: WebSocketSession, conversationId: String) {
        val conn = conns[session.id] ?: return
        if (!conn.conversationIds.add(conversationId)) return
        notifyPresence(conversationId, conn.userId, online = true, excludeSessionId = session.id)
        peersIn(conversationId, excludeSessionId = session.id)
            .filter { it.userId != conn.userId }
            .forEach { peer ->
                send(conn.session, envelope("presence", conversationId, DmPresencePayload(peer.userId, online = true)))
            }
    }

    fun unsubscribe(session: WebSocketSession, conversationId: String) {
        val conn = conns[session.id] ?: return
        if (!conn.conversationIds.remove(conversationId)) return
        notifyPresence(conversationId, conn.userId, online = false, excludeSessionId = session.id)
    }

    fun publishMessage(conversationId: String, payload: DmMessagePayload, excludeUserId: Long? = null) {
        broadcast(conversationId, "message", payload, excludeUserId)
    }

    fun publishRead(conversationId: String, payload: DmReadPayload, excludeUserId: Long? = null) {
        broadcast(conversationId, "read", payload, excludeUserId)
    }

    fun publishTyping(conversationId: String, userId: Long, active: Boolean) {
        broadcast(conversationId, "typing", DmTypingPayload(userId, active), excludeUserId = userId)
    }

    private fun notifyPresence(conversationId: String, userId: Long, online: Boolean, excludeSessionId: String) {
        broadcast(
            conversationId,
            "presence",
            DmPresencePayload(userId, online),
            excludeUserId = userId,
            excludeSessionId = excludeSessionId,
        )
    }

    private fun broadcast(
        conversationId: String,
        type: String,
        payload: Any,
        excludeUserId: Long? = null,
        excludeSessionId: String? = null,
    ) {
        val json = envelope(type, conversationId, payload)
        peersIn(conversationId, excludeSessionId).forEach { conn ->
            if (excludeUserId != null && conn.userId == excludeUserId) return@forEach
            send(conn.session, json)
        }
    }

    private fun peersIn(conversationId: String, excludeSessionId: String? = null): List<Conn> =
        conns.values.filter { conn ->
            conn.session.id != excludeSessionId && conversationId in conn.conversationIds && conn.session.isOpen
        }

    private fun send(session: WebSocketSession, json: String) {
        if (!session.isOpen) return
        runCatching { session.sendMessage(TextMessage(json)) }
    }

    private fun envelope(type: String, conversationId: String, payload: Any): String =
        mapper.writeValueAsString(
            mapOf(
                "type" to type,
                "conversationId" to conversationId,
                "payload" to payload,
            ),
        )

    /** 테스트·디버그용 구독자 수. */
    internal fun subscriberCount(conversationId: String): Int =
        peersIn(conversationId).size
}

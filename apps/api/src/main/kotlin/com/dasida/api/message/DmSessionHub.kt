package com.dasida.api.message

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.stereotype.Component
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import tools.jackson.databind.json.JsonMapper
import java.util.concurrent.ConcurrentHashMap

@Component
class DmSessionHub(
    private val mapper: JsonMapper,
) {
    @Autowired(required = false)
    private var fanout: DmWsFanout? = null
    private data class Conn(
        val session: WebSocketSession,
        val userId: Long,
        // 소유 세션 스레드가 subscribe/unsubscribe 로 변형하는 동안 다른 사용자의
        // 발신 스레드가 peersIn/unregister 에서 순회하므로 동시성 안전 집합을 쓴다.
        val conversationIds: MutableSet<String> = ConcurrentHashMap.newKeySet(),
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
        deliverRoom(conversationId, "message", payload, excludeUserId)
        relayRoom(conversationId, "message", payload, excludeUserId)
    }

    fun publishMessageDeleted(conversationId: String, payload: DmMessageDeletedPayload, excludeUserId: Long? = null) {
        deliverRoom(conversationId, "message-deleted", payload, excludeUserId)
        relayRoom(conversationId, "message-deleted", payload, excludeUserId)
    }

    fun publishRead(conversationId: String, payload: DmReadPayload, excludeUserId: Long? = null) {
        deliverRoom(conversationId, "read", payload, excludeUserId)
        relayRoom(conversationId, "read", payload, excludeUserId)
    }

    fun publishTyping(conversationId: String, userId: Long, active: Boolean) {
        val payload = DmTypingPayload(userId, active)
        deliverRoom(conversationId, "typing", payload, excludeUserId = userId)
        relayRoom(conversationId, "typing", payload, excludeUserId = userId)
    }

    fun publishInbox(userId: Long, conversationId: String, inbox: DmInboxPayload) {
        deliverToUser(userId, envelope("inbox", conversationId, inbox))
        fanout?.relay(
            DmRelayEnvelope(
                kind = "inbox",
                userId = userId,
                conversationId = conversationId,
                payload = inbox,
            ),
        )
    }

    /** 알림 배지 갱신 이벤트. 대화와 무관한 사용자 단위 이벤트라 conversationId 는 비워 보낸다. */
    fun publishNotification(userId: Long, payload: DmNotificationPayload) {
        deliverToUser(userId, envelope("notification", conversationId = "", payload = payload))
        fanout?.relay(
            DmRelayEnvelope(
                kind = "notification",
                userId = userId,
                conversationId = "",
                payload = payload,
            ),
        )
    }

    /** 다른 JVM 인스턴스에서 Redis 로 수신한 이벤트 — 재 fan-out 없음. */
    fun deliverFromRelay(envelope: DmRelayEnvelope) {
        when (envelope.kind) {
            "inbox" -> {
                val userId = envelope.userId ?: return
                val payload = envelope.payload ?: return
                val inbox = mapper.convertValue(payload, DmInboxPayload::class.java)
                deliverToUser(userId, envelope("inbox", envelope.conversationId, inbox))
            }
            "notification" -> {
                val userId = envelope.userId ?: return
                val payload = envelope.payload ?: return
                val notification = mapper.convertValue(payload, DmNotificationPayload::class.java)
                deliverToUser(userId, envelope("notification", conversationId = "", payload = notification))
            }
            "room" -> {
                val eventType = envelope.eventType ?: return
                val payload = envelope.payload ?: return
                deliverRoom(envelope.conversationId, eventType, payload, envelope.excludeUserId)
            }
        }
    }

    private fun deliverToUser(userId: Long, json: String) {
        conns.values
            .filter { it.userId == userId && it.session.isOpen }
            .forEach { send(it.session, json) }
    }

    private fun deliverRoom(
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

    private fun relayRoom(conversationId: String, eventType: String, payload: Any, excludeUserId: Long?) {
        fanout?.relay(
            DmRelayEnvelope(
                kind = "room",
                conversationId = conversationId,
                eventType = eventType,
                payload = payload,
                excludeUserId = excludeUserId,
            ),
        )
    }

    private fun notifyPresence(conversationId: String, userId: Long, online: Boolean, excludeSessionId: String) {
        deliverRoom(
            conversationId,
            "presence",
            DmPresencePayload(userId, online),
            excludeUserId = userId,
            excludeSessionId = excludeSessionId,
        )
        relayRoom(conversationId, "presence", DmPresencePayload(userId, online), excludeUserId = userId)
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

    internal fun subscriberCount(conversationId: String): Int =
        peersIn(conversationId).size
}

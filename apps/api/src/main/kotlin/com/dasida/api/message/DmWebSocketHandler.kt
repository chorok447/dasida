package com.dasida.api.message

import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler
import tools.jackson.databind.json.JsonMapper

@Component
class DmWebSocketHandler(
    private val hub: DmSessionHub,
    private val members: ConversationMemberRepository,
    private val mapper: JsonMapper,
) : TextWebSocketHandler() {
    override fun afterConnectionEstablished(session: WebSocketSession) {
        val userId = session.userId() ?: run {
            session.close(CloseStatus.POLICY_VIOLATION)
            return
        }
        hub.register(session, userId)
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        hub.unregister(session)
    }

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        val userId = session.userId() ?: return
        val node = runCatching { mapper.readTree(message.payload) }.getOrNull() ?: return
        val type = node.get("type")?.asString() ?: return
        val conversationId = node.get("conversationId")?.asString()?.takeIf { it.isNotBlank() } ?: return
        if (!isMember(userId, conversationId)) return

        when (type) {
            "subscribe" -> hub.subscribe(session, conversationId)
            "unsubscribe" -> hub.unsubscribe(session, conversationId)
            "typing" -> {
                val active = node.get("active")?.asBoolean() ?: true
                hub.publishTyping(conversationId, userId, active)
            }
        }
    }

    private fun isMember(userId: Long, conversationId: String): Boolean =
        members.findByConversationIdAndUserId(conversationId, userId) != null

    private fun WebSocketSession.userId(): Long? =
        attributes[DmHandshakeInterceptor.ATTR_USER_ID] as? Long
}

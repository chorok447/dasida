package com.dasida.api.message

import com.dasida.api.auth.UserRepository
import com.dasida.api.security.JwtService
import com.dasida.api.security.TokenDenylistStore
import com.dasida.api.security.authCookieToken
import com.dasida.api.security.hashToken
import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.http.server.ServletServerHttpRequest
import org.springframework.stereotype.Component
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.server.HandshakeInterceptor

@Component
class DmHandshakeInterceptor(
    private val jwt: JwtService,
    private val users: UserRepository,
    private val denylist: TokenDenylistStore,
) : HandshakeInterceptor {
    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        attributes: MutableMap<String, Any>,
    ): Boolean {
        val servlet = (request as? ServletServerHttpRequest)?.servletRequest ?: return false
        val token = servlet.authCookieToken()
            ?: servlet.getParameter("token")?.takeIf { it.isNotBlank() }
            ?: return false
        return try {
            if (denylist.isDenied(hashToken(token))) return false
            val user = jwt.parse(token)
            val stored = users.findById(user.id).orElse(null) ?: return false
            if (stored.deletedAt != null) return false
            attributes[ATTR_USER_ID] = user.id
            true
        } catch (_: Exception) {
            false
        }
    }

    override fun afterHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        exception: Exception?,
    ) = Unit

    companion object {
        const val ATTR_USER_ID = "dmUserId"
    }
}

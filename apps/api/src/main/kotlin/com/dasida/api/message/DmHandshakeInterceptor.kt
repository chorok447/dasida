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
    private val clock: java.time.Clock,
) : HandshakeInterceptor {
    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        attributes: MutableMap<String, Any>,
    ): Boolean {
        val servlet = (request as? ServletServerHttpRequest)?.servletRequest ?: return false
        // 토큰은 httpOnly 쿠키로만 받는다. URL 쿼리파라미터(?token=)는 접근/프록시 로그·
        // 브라우저 히스토리·Referer 로 새므로 폴백을 두지 않는다(프런트도 쿠키만 사용).
        val token = servlet.authCookieToken() ?: return false
        return try {
            if (denylist.isDenied(hashToken(token))) return false
            val user = jwt.parse(token)
            val stored = users.findById(user.id).orElse(null) ?: return false
            if (stored.deletedAt != null) return false
            // HTTP 필터(JwtAuthFilter)와 동일 정책: 정지 계정·자격증명 변경 이전 발급 토큰은 소켓도 거절.
            if (stored.isSuspendedAt(java.time.Instant.now(clock))) return false
            if (stored.isTokenIssuedBeforeCredentialsChange(jwt.issuedAtInstant(token))) return false
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

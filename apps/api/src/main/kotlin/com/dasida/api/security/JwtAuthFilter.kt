package com.dasida.api.security

import com.dasida.api.auth.UserRepository
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

/**
 * Authorization: Bearer <jwt> 를 읽어 SecurityContext 에 인증을 채운다.
 * - 헤더 없음 / Bearer 형식 아님 → 미인증으로 통과(공개 엔드포인트 접근 허용).
 * - Bearer 토큰이 명시됐는데 invalid이거나 DB 사용자가 없거나 탈퇴함 → 즉시 401, 체인 중단.
 */
@Component
class JwtAuthFilter(
    private val jwt: JwtService,
    private val users: UserRepository,
    private val denylist: TokenDenylistStore,
) : OncePerRequestFilter() {
    override fun doFilterInternal(req: HttpServletRequest, res: HttpServletResponse, chain: FilterChain) {
        val header = req.getHeader("Authorization")
        if (header != null && header.startsWith("Bearer ")) {
            try {
                val token = header.substring(7)
                val user = jwt.parse(token)
                // 로그아웃된 토큰은 만료 전이라도 거절. 서명·형식 검증 이후에만 조회한다.
                if (denylist.isDenied(hashToken(token))) {
                    throw IllegalArgumentException("denylisted token")
                }
                val storedUser = users.findById(user.id).orElse(null)
                if (storedUser == null || storedUser.deletedAt != null) {
                    throw IllegalArgumentException("inactive token user")
                }
                val auth = UsernamePasswordAuthenticationToken(user, null, listOf(SimpleGrantedAuthority("ROLE_USER")))
                SecurityContextHolder.getContext().authentication = auth
            } catch (_: Exception) {
                // 명시적으로 Bearer 토큰을 줬는데 유효하지 않음 → 401 로 즉시 거절
                SecurityContextHolder.clearContext()
                res.status = HttpServletResponse.SC_UNAUTHORIZED
                return
            }
        }
        chain.doFilter(req, res)
    }
}

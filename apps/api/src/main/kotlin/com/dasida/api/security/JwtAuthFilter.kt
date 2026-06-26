package com.dasida.api.security

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
 * - Bearer 토큰이 명시됐는데 invalid(깨짐/만료/파싱 실패) → 즉시 401, 체인 중단.
 */
@Component
class JwtAuthFilter(private val jwt: JwtService) : OncePerRequestFilter() {
    override fun doFilterInternal(req: HttpServletRequest, res: HttpServletResponse, chain: FilterChain) {
        val header = req.getHeader("Authorization")
        if (header != null && header.startsWith("Bearer ")) {
            try {
                val user = jwt.parse(header.substring(7))
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

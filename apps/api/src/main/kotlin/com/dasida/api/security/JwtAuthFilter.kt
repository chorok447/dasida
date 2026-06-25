package com.dasida.api.security

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

/** Authorization: Bearer <jwt> 를 읽어 SecurityContext 에 인증을 채운다. 토큰이 없거나 깨지면 그냥 통과(미인증). */
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
                // 유효하지 않은 토큰 → 미인증으로 진행
            }
        }
        chain.doFilter(req, res)
    }
}

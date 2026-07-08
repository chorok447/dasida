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
 * Authorization: Bearer <jwt> 또는 httpOnly 인증 쿠키를 읽어 SecurityContext 에 인증을 채운다.
 * 헤더가 우선(API 클라이언트·테스트 호환), 없으면 쿠키(브라우저) fallback.
 * - 둘 다 없음 → 미인증으로 통과(공개 엔드포인트 접근 허용).
 * - 토큰이 명시됐는데 invalid이거나 DB 사용자가 없거나 탈퇴함 → 즉시 401, 체인 중단.
 */
@Component
class JwtAuthFilter(
    private val jwt: JwtService,
    private val users: UserRepository,
    private val denylist: TokenDenylistStore,
    private val meterRegistry: io.micrometer.core.instrument.MeterRegistry,
) : OncePerRequestFilter() {
    override fun doFilterInternal(req: HttpServletRequest, res: HttpServletResponse, chain: FilterChain) {
        val header = req.getHeader("Authorization")
        val token = if (header != null && header.startsWith("Bearer ")) header.substring(7) else req.authCookieToken()
        if (token != null) {
            try {
                val user = jwt.parse(token)
                // 로그아웃된 토큰은 만료 전이라도 거절. 서명·형식 검증 이후에만 조회한다.
                if (isDeniedFailClosed(token)) {
                    throw IllegalArgumentException("denylisted token or denylist unavailable")
                }
                val storedUser = users.findById(user.id).orElse(null)
                if (storedUser == null || storedUser.deletedAt != null) {
                    throw IllegalArgumentException("inactive token user")
                }
                // 권한은 JWT 클레임이 아니라 DB role 에서 매 요청 읽는다(어차피 위에서 사용자 조회 필수).
                // 관리자 권한 회수가 기존 토큰 만료를 기다리지 않고 즉시 반영된다.
                val authorities = buildList {
                    add(SimpleGrantedAuthority("ROLE_USER"))
                    if (storedUser.isAdmin) add(SimpleGrantedAuthority("ROLE_ADMIN"))
                }
                val auth = UsernamePasswordAuthenticationToken(user, null, authorities)
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

    /**
     * denylist 등록 여부. store(예: Redis) 장애로 확인할 수 없으면 fail-closed:
     * 무효화됐을 수 있는 토큰을 통과시키지 않고 거절한다(인증 보안 경로 → rate limit 의 fail-open 과 반대).
     * catch-all 에 우연히 묻히지 않도록 unavailable 케이스를 여기서 명시적으로 처리·로깅한다.
     */
    private fun isDeniedFailClosed(token: String): Boolean =
        try {
            denylist.isDenied(hashToken(token))
        } catch (ex: Exception) {
            // store 장애로 무효화 여부 확인 불가 → fail-closed. metric·경고 로그만 남긴다.
            // 로그에 raw token/token hash 를 남기지 않는다(민감정보 미출력).
            meterRegistry.counter(STORE_UNAVAILABLE_METRIC, "policy", "fail_closed").increment()
            log.warn("denylist store unavailable, failing closed (policy=fail_closed, denying request)", ex)
            true
        }

    private companion object {
        private val log = org.slf4j.LoggerFactory.getLogger(JwtAuthFilter::class.java)
        const val STORE_UNAVAILABLE_METRIC = "dasida.security.token_denylist.store_unavailable"
    }
}

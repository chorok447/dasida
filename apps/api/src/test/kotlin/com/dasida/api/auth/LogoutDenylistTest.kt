package com.dasida.api.auth

import com.dasida.api.security.JwtService
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional

/**
 * 로그아웃 denylist 통합 테스트. logout 후 동일 access token 이 만료 전이라도 거절되는지 검증한다.
 * in-memory denylist store(기본 프로파일) 기준. 각 테스트는 고유 토큰을 써 store 간섭이 없다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class LogoutDenylistTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val repo: UserRepository,
    @param:Autowired val jwt: JwtService,
    @param:Value("\${app.jwt.secret}") val secret: String,
) {
    private fun saveUser(email: String): User =
        repo.saveAndFlush(User(email = email, passwordHash = "h", name = "유저"))

    @Test
    fun `로그아웃하면 같은 토큰으로 인증 API 호출 시 401`() {
        val token = jwt.issue(saveUser("logout-me@dasida.com"))

        // 로그아웃 전에는 정상 동작
        mvc.get("/api/auth/me") { headers { add("Authorization", "Bearer $token") } }
            .andExpect { status { isOk() } }

        mvc.post("/api/auth/logout") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$.loggedOut") { value(true) }
            }

        // 로그아웃 후 같은 토큰은 거절
        mvc.get("/api/auth/me") { headers { add("Authorization", "Bearer $token") } }
            .andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `로그아웃은 해당 토큰만 무효화하고 다른 사용자 토큰은 영향받지 않는다`() {
        val tokenA = jwt.issue(saveUser("logout-a@dasida.com"))
        val tokenB = jwt.issue(saveUser("logout-b@dasida.com"))

        mvc.post("/api/auth/logout") { headers { add("Authorization", "Bearer $tokenA") } }
            .andExpect { status { isOk() } }

        mvc.get("/api/auth/me") { headers { add("Authorization", "Bearer $tokenA") } }
            .andExpect { status { isUnauthorized() } }
        mvc.get("/api/auth/me") { headers { add("Authorization", "Bearer $tokenB") } }
            .andExpect { status { isOk() } }
    }

    @Test
    fun `미인증 로그아웃은 401`() {
        mvc.post("/api/auth/logout").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `만료된 토큰 로그아웃은 401 - denylist 에 등록되지 않는다`() {
        // 앱과 동일한 서명키로 이미 만료된 토큰을 만든다(음수 TTL). 필터가 만료로 401 처리한다.
        val expired = JwtService(secret, -1000, 1209600000, "").issue(saveUser("logout-expired@dasida.com"))

        mvc.post("/api/auth/logout") { headers { add("Authorization", "Bearer $expired") } }
            .andExpect { status { isUnauthorized() } }
    }
}

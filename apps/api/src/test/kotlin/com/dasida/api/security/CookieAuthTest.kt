package com.dasida.api.security

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import jakarta.servlet.http.Cookie
import org.hamcrest.Matchers.containsString
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional

/**
 * httpOnly 인증 쿠키 통합 테스트.
 * 발급(회원가입/로그인) → 쿠키 인증 → 헤더 우선순위 → 쿠키 로그아웃(만료+무효화)을 검증한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CookieAuthTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val repo: UserRepository,
    @param:Autowired val jwt: JwtService,
) {
    private fun saveUser(email: String): User =
        repo.saveAndFlush(User(email = email, passwordHash = "h", name = "쿠키유저"))

    private fun authCookie(token: String) = Cookie(AuthCookies.NAME, token)

    @Test
    fun `회원가입하면 httpOnly SameSite=Lax 인증 쿠키가 발급된다`() {
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"cookie-signup@dasida.com","password":"Passw0rd!","name":"쿠키"}"""
        }.andExpect {
            status { isCreated() }
            header { string(HttpHeaders.SET_COOKIE, containsString("${AuthCookies.NAME}=")) }
            header { string(HttpHeaders.SET_COOKIE, containsString("HttpOnly")) }
            header { string(HttpHeaders.SET_COOKIE, containsString("SameSite=Lax")) }
            header { string(HttpHeaders.SET_COOKIE, containsString("Path=/")) }
        }
    }

    @Test
    fun `인증 쿠키만으로 보호 API 를 호출할 수 있다`() {
        val token = jwt.issue(saveUser("cookie-me@dasida.com"))
        mvc.get("/api/auth/me") { cookie(authCookie(token)) }
            .andExpect {
                status { isOk() }
                jsonPath("$.email") { value("cookie-me@dasida.com") }
            }
    }

    @Test
    fun `유효하지 않은 인증 쿠키는 401`() {
        mvc.get("/api/auth/me") { cookie(authCookie("garbage")) }
            .andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `Authorization 헤더가 쿠키보다 우선한다`() {
        val token = jwt.issue(saveUser("cookie-priority@dasida.com"))
        // 유효한 쿠키가 있어도 명시된 Bearer 토큰이 invalid 면 401 (헤더 우선)
        mvc.get("/api/auth/me") {
            headers { add("Authorization", "Bearer invalid") }
            cookie(authCookie(token))
        }.andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `쿠키 기반 로그아웃은 쿠키를 만료시키고 토큰을 무효화한다`() {
        val token = jwt.issue(saveUser("cookie-logout@dasida.com"))

        mvc.post("/api/auth/logout") { cookie(authCookie(token)) }
            .andExpect {
                status { isOk() }
                header { string(HttpHeaders.SET_COOKIE, containsString("${AuthCookies.NAME}=;")) }
                header { string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")) }
            }

        // denylist 등록 → 같은 토큰의 쿠키 인증도 거절
        mvc.get("/api/auth/me") { cookie(authCookie(token)) }
            .andExpect { status { isUnauthorized() } }
    }
}

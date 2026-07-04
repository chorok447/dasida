package com.dasida.api.security

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import jakarta.servlet.http.Cookie
import org.hamcrest.Matcher
import org.hamcrest.Matchers.allOf
import org.hamcrest.Matchers.containsString
import org.hamcrest.Matchers.hasItem
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
 * refresh token 통합 테스트.
 * 발급(로그인) → 재발급(rotation) → 재사용 차단 → type guard(access↔refresh 교차 사용 금지) → 로그아웃 무효화.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RefreshAuthTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val repo: UserRepository,
    @param:Autowired val jwt: JwtService,
) {
    private fun saveUser(email: String): User =
        repo.saveAndFlush(User(email = email, passwordHash = "h", name = "리프레시유저"))

    private fun refreshCookie(token: String) = Cookie(AuthCookies.REFRESH_NAME, token)

    private fun accessCookie(token: String) = Cookie(AuthCookies.NAME, token)

    @Test
    fun `회원가입하면 Path 가 제한된 httpOnly refresh 쿠키가 함께 발급된다`() {
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"refresh-signup@dasida.com","password":"Passw0rd!","name":"리프레시"}"""
        }.andExpect {
            status { isCreated() }
            header { stringValues(HttpHeaders.SET_COOKIE, hasRefreshCookieAttrs()) }
        }
    }

    @Test
    fun `refresh 쿠키로 새 access·refresh 가 재발급된다`() {
        val user = saveUser("refresh-ok@dasida.com")
        mvc.post("/api/auth/refresh") { cookie(refreshCookie(jwt.issueRefresh(user))) }
            .andExpect {
                status { isOk() }
                jsonPath("$.token") { exists() }
                header { stringValues(HttpHeaders.SET_COOKIE, hasRefreshCookieAttrs()) }
            }
    }

    @Test
    fun `사용한 refresh token 은 재사용할 수 없다 (rotation)`() {
        val token = jwt.issueRefresh(saveUser("refresh-rotate@dasida.com"))

        mvc.post("/api/auth/refresh") { cookie(refreshCookie(token)) }
            .andExpect { status { isOk() } }
        // 같은 토큰 재사용 → denylist 에 등록되어 401
        mvc.post("/api/auth/refresh") { cookie(refreshCookie(token)) }
            .andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `refresh token 으로는 보호 API 를 호출할 수 없다`() {
        val token = jwt.issueRefresh(saveUser("refresh-as-access@dasida.com"))
        mvc.get("/api/auth/me") { cookie(accessCookie(token)) }
            .andExpect { status { isUnauthorized() } }
        mvc.get("/api/auth/me") { headers { add("Authorization", "Bearer $token") } }
            .andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `access token 으로는 refresh 할 수 없다`() {
        val token = jwt.issue(saveUser("access-as-refresh@dasida.com"))
        mvc.post("/api/auth/refresh") { cookie(refreshCookie(token)) }
            .andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `refresh 쿠키가 없으면 401`() {
        mvc.post("/api/auth/refresh").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `로그아웃하면 refresh token 도 무효화되고 쿠키가 만료된다`() {
        val user = saveUser("refresh-logout@dasida.com")
        val access = jwt.issue(user)
        val refresh = jwt.issueRefresh(user)

        mvc.post("/api/auth/logout") {
            cookie(accessCookie(access), refreshCookie(refresh))
        }.andExpect {
            status { isOk() }
            header { stringValues(HttpHeaders.SET_COOKIE, hasExpiredRefreshCookie()) }
        }

        mvc.post("/api/auth/refresh") { cookie(refreshCookie(refresh)) }
            .andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `탈퇴한 사용자의 refresh token 은 거절된다`() {
        val user = saveUser("refresh-deleted@dasida.com")
        val refresh = jwt.issueRefresh(user)
        user.deletedAt = java.time.Instant.now()
        repo.saveAndFlush(user)

        mvc.post("/api/auth/refresh") { cookie(refreshCookie(refresh)) }
            .andExpect { status { isUnauthorized() } }
    }

    // hasItem 은 Matcher<Iterable<in String>> 을 돌려줘 MockMvc DSL 시그니처와 안 맞으므로 캐스트로 좁힌다.
    @Suppress("UNCHECKED_CAST")
    private fun hasRefreshCookieAttrs(): Matcher<Iterable<String>> =
        hasItem(
            allOf(
                containsString("${AuthCookies.REFRESH_NAME}="),
                containsString("HttpOnly"),
                containsString("SameSite=Lax"),
                containsString("Path=${AuthCookies.REFRESH_PATH}"),
            ),
        ) as Matcher<Iterable<String>>

    @Suppress("UNCHECKED_CAST")
    private fun hasExpiredRefreshCookie(): Matcher<Iterable<String>> =
        hasItem(
            allOf(
                containsString("${AuthCookies.REFRESH_NAME}=;"),
                containsString("Max-Age=0"),
            ),
        ) as Matcher<Iterable<String>>
}

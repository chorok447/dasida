package com.dasida.api.security

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.resttestclient.TestRestTemplate
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import java.util.UUID

/**
 * 에러 상태 마스킹 회귀 방지. MockMvc 는 ERROR 디스패치를 거치지 않아 마스킹을 못 잡으므로
 * 실제 서블릿 컨테이너(RANDOM_PORT)로 필터체인 + /error 재디스패치를 그대로 태운다.
 *
 * 버그: ResponseStatusException(400/409) 가 던져지면 Spring 이 /error 로 재디스패치하는데,
 * /error 가 인가 대상이면 미인증 요청에서 원래 상태가 401 로 마스킹된다.
 * 픽스: dispatcherTypeMatchers(ERROR).permitAll() → 원래 상태 보존, 직접 /error 접근은 여전히 차단.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class ErrorStatusUnmaskTest(@Autowired val rest: TestRestTemplate) {

    private fun jsonPost(path: String, body: String, token: String? = null) =
        rest.exchange(
            path,
            HttpMethod.POST,
            HttpEntity(body, HttpHeaders().apply {
                contentType = MediaType.APPLICATION_JSON
                token?.let { set("Authorization", "Bearer $it") }
            }),
            String::class.java,
        )

    @Test
    fun `미인증 요청의 400 은 401 로 마스킹되지 않는다`() {
        // 짧은 비밀번호 → 컨트롤러가 400. signup 은 permitAll 이라 인증과 무관.
        val res = jsonPost(
            "/api/auth/signup",
            """{"email":"unmask400@dasida.com","password":"short","name":"엑스"}""",
        )
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `미인증 요청의 409 는 401 로 마스킹되지 않는다`() {
        val email = "dup-${UUID.randomUUID()}@dasida.com"
        val body = """{"email":"$email","password":"password1!","name":"중복"}"""
        assertThat(jsonPost("/api/auth/signup", body).statusCode).isEqualTo(HttpStatus.CREATED)
        // 같은 이메일 재가입 → 409 CONFLICT 가 보존되어야 함.
        assertThat(jsonPost("/api/auth/signup", body).statusCode).isEqualTo(HttpStatus.CONFLICT)
    }

    @Test
    fun `로그인 자격증명 오류는 401`() {
        val res = jsonPost(
            "/api/auth/login",
            """{"email":"nobody-${UUID.randomUUID()}@dasida.com","password":"password1!"}""",
        )
        assertThat(res.statusCode).isEqualTo(HttpStatus.UNAUTHORIZED)
    }

    @Test
    fun `깨진 Bearer 토큰은 401`() {
        val res = jsonPost(
            "/api/posts",
            """{"text":"hi"}""",
            token = "this.is.not-a-valid-jwt",
        )
        assertThat(res.statusCode).isEqualTo(HttpStatus.UNAUTHORIZED)
    }

    @Test
    fun `보호 API 무토큰 접근은 401`() {
        // POST /api/posts 는 인증 필요. 토큰 없이 호출 → 401.
        val res = jsonPost("/api/posts", """{"text":"hi"}""")
        assertThat(res.statusCode).isEqualTo(HttpStatus.UNAUTHORIZED)
    }

    @Test
    fun `error 엔드포인트 직접 접근은 차단된다`() {
        // 클라이언트가 직접 친 /error 는 REQUEST 디스패치 → 인가 대상 → 401(200 노출 금지).
        val res = rest.getForEntity("/error", String::class.java)
        assertThat(res.statusCode).isEqualTo(HttpStatus.UNAUTHORIZED)
    }
}

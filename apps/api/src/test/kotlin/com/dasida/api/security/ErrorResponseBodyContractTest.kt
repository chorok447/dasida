package com.dasida.api.security

import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.client.TestRestTemplate
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import java.util.UUID

/**
 * 에러 응답 body 계약 회귀 방지.
 *
 * 상태 코드(400/401/403/404/409)는 각 도메인 컨트롤러 테스트가 이미 고정한다. 이 테스트는 그와 겹치지 않게
 * "에러 body 형태"만 고정한다. 리팩터링이나 `server.error.*`/보안 설정 변경으로 다음이 깨지지 않는지 확인한다.
 *
 * - ResponseStatusException(400/404/409) 는 Spring 기본 /error 로 재디스패치되어 JSON body 를 만든다.
 *   body 의 `status` 는 실제 status 와 일치하고, stacktrace/exception class/내부 reason message 는 노출하지 않는다.
 * - 미인증(401) 은 HttpStatusEntryPoint 로 status 전용 응답이라 본문에 내부 정보를 담지 않는다.
 *
 * MockMvc 는 ERROR 디스패치를 타지 않아 /error body 를 재현하지 못하므로 실제 서블릿 컨테이너(RANDOM_PORT)로 검증한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ErrorResponseBodyContractTest(
    @Autowired val rest: TestRestTemplate,
    @Autowired val mapper: ObjectMapper,
) {
    private fun jsonGet(path: String) =
        rest.exchange(path, HttpMethod.GET, HttpEntity<Void>(jsonHeaders()), String::class.java)

    private fun jsonPost(path: String, body: String) =
        rest.exchange(path, HttpMethod.POST, HttpEntity(body, jsonHeaders()), String::class.java)

    private fun jsonHeaders() = HttpHeaders().apply {
        contentType = MediaType.APPLICATION_JSON
        accept = listOf(MediaType.APPLICATION_JSON)
    }

    /** /error body 공통 계약: status 필드가 실제 status 와 일치하고 내부 구현 정보를 노출하지 않는다. */
    private fun assertErrorBodyContract(res: ResponseEntity<String>, expected: HttpStatus, leakedDetail: String) {
        assertThat(res.statusCode).isEqualTo(expected)
        val body = requireNotNull(res.body) { "error body must not be null" }
        val json = mapper.readTree(body)
        assertThat(json.path("status").asInt()).isEqualTo(expected.value())
        // stacktrace / 예외 클래스 / 내부 reason message 는 외부로 노출하지 않는다.
        assertThat(json.has("trace")).isFalse()
        assertThat(json.has("exception")).isFalse()
        assertThat(body).doesNotContain(leakedDetail)
        assertThat(body).doesNotContain("com.dasida")
    }

    @Test
    fun `404 에러 body는 status를 담고 내부 예외 메시지와 stacktrace를 노출하지 않는다`() {
        // PostService 는 "post <id> not found" 를 던지지만 기본 정책상 그 메시지는 body 로 새면 안 된다.
        assertErrorBodyContract(jsonGet("/api/posts/nope"), HttpStatus.NOT_FOUND, leakedDetail = "not found")
    }

    @Test
    fun `400 에러 body는 status를 담고 내부 구현 정보를 노출하지 않는다`() {
        val res = jsonPost(
            "/api/auth/signup",
            """{"email":"body400@dasida.com","password":"short","name":"엑스"}""",
        )
        assertErrorBodyContract(res, HttpStatus.BAD_REQUEST, leakedDetail = "Exception")
    }

    @Test
    fun `409 에러 body는 status를 담고 내부 구현 정보를 노출하지 않는다`() {
        val body = """{"email":"body-conflict-${UUID.randomUUID()}@dasida.com","password":"password1!","name":"중복"}"""
        assertThat(jsonPost("/api/auth/signup", body).statusCode).isEqualTo(HttpStatus.CREATED)
        assertErrorBodyContract(jsonPost("/api/auth/signup", body), HttpStatus.CONFLICT, leakedDetail = "Exception")
    }

    @Test
    fun `미인증 401은 status 전용 응답이라 본문으로 내부 정보를 노출하지 않는다`() {
        // 보호 API 무토큰 접근 → HttpStatusEntryPoint 가 401 status 만 반환하고 에러 본문을 만들지 않는다.
        val res = jsonPost("/api/posts", """{"text":"hi"}""")
        assertThat(res.statusCode).isEqualTo(HttpStatus.UNAUTHORIZED)
        val body = res.body
        // 본문이 없거나(빈 응답) 최소한 stacktrace/예외 클래스/내부 패키지를 노출하지 않아야 한다.
        if (!body.isNullOrBlank()) {
            assertThat(body).doesNotContain("com.dasida")
            assertThat(body).doesNotContain("Exception")
            assertThat(body).doesNotContain("trace")
        }
    }
}

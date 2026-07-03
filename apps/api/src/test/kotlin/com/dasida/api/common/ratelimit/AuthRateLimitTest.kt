package com.dasida.api.common.ratelimit

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(
    properties = [
        "app.rate-limit.store=memory",
        "app.rate-limit.auth.login.limit=2",
        "app.rate-limit.auth.signup.limit=2",
        "app.rate-limit.auth.login.window-seconds=60",
        "app.rate-limit.auth.signup.window-seconds=60",
    ],
)
class AuthRateLimitTest(
    @param:Autowired private val mvc: MockMvc,
) {
    @Test
    fun `로그인은 IP당 limit 초과 시 429를 반환한다`() {
        val body = """{"email":"missing@dasida.com","password":"wrong-password"}"""
        repeat(2) {
            mvc.post("/api/auth/login") {
                contentType = MediaType.APPLICATION_JSON
                content = body
            }.andExpect { status { isUnauthorized() } }
        }
        mvc.post("/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = body
        }.andExpect {
            status { isTooManyRequests() }
            header { exists("Retry-After") }
        }
    }

    @Test
    fun `회원가입은 IP당 limit 초과 시 429를 반환한다`() {
        repeat(2) {
            val email = "rate-limit-${UUID.randomUUID()}@dasida.com"
            val body = """{"email":"$email","password":"password1!","name":"한도"}"""
            mvc.post("/api/auth/signup") {
                contentType = MediaType.APPLICATION_JSON
                content = body
            }.andExpect { status { isCreated() } }
        }
        val body = """{"email":"rate-limit-${UUID.randomUUID()}@dasida.com","password":"password1!","name":"한도"}"""
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = body
        }.andExpect {
            status { isTooManyRequests() }
            header { exists("Retry-After") }
        }
    }
}

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = ["app.rate-limit.enabled=false"])
class AuthRateLimitDisabledTest(
    @param:Autowired private val mvc: MockMvc,
) {
    @Test
    fun `rate limit 비활성화 시 로그인 요청이 429로 차단되지 않는다`() {
        val body = """{"email":"missing@dasida.com","password":"wrong-password"}"""
        repeat(5) {
            mvc.post("/api/auth/login") {
                contentType = MediaType.APPLICATION_JSON
                content = body
            }.andExpect { status { isUnauthorized() } }
        }
    }
}

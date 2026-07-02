package com.dasida.api.security

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.HttpHeaders
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.options

/**
 * default/test 프로파일 CORS 검증. CORS 허용은 인증 허용과 다르다는 점을 함께 확인한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CorsConfigTest(
    @Autowired private val mvc: MockMvc,
) {
    @Test
    fun `허용 origin localhost preflight 는 CORS 헤더를 포함한다`() {
        mvc.options("/api/auth/me") {
            header(HttpHeaders.ORIGIN, "http://localhost:3000")
            header("Access-Control-Request-Method", "GET")
            header("Access-Control-Request-Headers", "Authorization")
        }.andExpect {
            status { isOk() }
            header { string("Access-Control-Allow-Origin", "http://localhost:3000") }
            header { string("Access-Control-Allow-Credentials", "true") }
            header { stringValues("Access-Control-Allow-Headers", "Authorization") }
        }
    }

    @Test
    fun `허용 origin 127_0_0_1 preflight 성공 및 Content-Type 허용`() {
        mvc.options("/api/auth/me") {
            header(HttpHeaders.ORIGIN, "http://127.0.0.1:3000")
            header("Access-Control-Request-Method", "POST")
            header("Access-Control-Request-Headers", "Content-Type")
        }.andExpect {
            status { isOk() }
            header { string("Access-Control-Allow-Origin", "http://127.0.0.1:3000") }
        }
    }

    @Test
    fun `비허용 origin 은 Access-Control-Allow-Origin 을 받지 못한다`() {
        mvc.options("/api/auth/me") {
            header(HttpHeaders.ORIGIN, "https://evil.example.com")
            header("Access-Control-Request-Method", "GET")
        }.andExpect {
            header { doesNotExist("Access-Control-Allow-Origin") }
        }
    }

    @Test
    fun `CORS 허용은 인증 우회가 아니다 - 무토큰 GET me 는 여전히 401`() {
        mvc.get("/api/auth/me") {
            header(HttpHeaders.ORIGIN, "http://localhost:3000")
        }.andExpect {
            status { isUnauthorized() }
            header { string("Access-Control-Allow-Origin", "http://localhost:3000") }
        }
    }
}

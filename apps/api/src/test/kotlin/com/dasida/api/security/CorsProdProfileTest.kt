package com.dasida.api.security

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.HttpHeaders
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.options

/**
 * prod 프로파일 CORS 검증. 명시 origin 을 주입하면 context 가 정상 기동하고 해당 origin preflight 가 허용된다.
 *
 * JwtService 의 prod secret guard 는 약화하지 않고 테스트용 안전 시크릿만 주입한다.
 * CORS origin 도 prod guard 를 만족하는 명시 https origin 을 주입한다(dev localhost 상속 방지).
 */
@SpringBootTest(
    properties = [
        "app.jwt.secret=test-prod-secret-that-is-long-enough-for-tests-1234567890",
        "app.cors.allowed-origins=https://app.example.com,https://www.example.com",
    ],
)
@AutoConfigureMockMvc
@ActiveProfiles("prod")
class CorsProdProfileTest(
    @param:Autowired private val mvc: MockMvc,
) {
    @Test
    fun `prod 명시 origin preflight 는 CORS 헤더를 포함한다`() {
        mvc.options("/api/auth/me") {
            header(HttpHeaders.ORIGIN, "https://app.example.com")
            header("Access-Control-Request-Method", "GET")
            header("Access-Control-Request-Headers", "Authorization")
        }.andExpect {
            status { isOk() }
            header { string("Access-Control-Allow-Origin", "https://app.example.com") }
            header { string("Access-Control-Allow-Credentials", "true") }
        }
    }

    @Test
    fun `prod 에서 dev localhost origin 은 허용되지 않는다`() {
        mvc.options("/api/auth/me") {
            header(HttpHeaders.ORIGIN, "http://localhost:3000")
            header("Access-Control-Request-Method", "GET")
        }.andExpect {
            header { doesNotExist("Access-Control-Allow-Origin") }
        }
    }
}

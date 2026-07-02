package com.dasida.api.security

import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

/**
 * prod 프로파일에서도 Actuator 노출 정책이 동일한지 검증한다.
 * prod 기동에 필요한 guard(JWT secret, CORS origin)를 약화하지 않고 테스트용 안전 값만 주입한다.
 */
@SpringBootTest(
    properties = [
        "app.jwt.secret=test-prod-secret-that-is-long-enough-for-tests-1234567890",
        "app.cors.allowed-origins=https://app.example.com",
    ],
)
@AutoConfigureMockMvc
@ActiveProfiles("prod")
class ActuatorProdProfileTest(
    @Autowired private val mvc: MockMvc,
) {
    @Test
    fun `prod 에서도 health 는 200 이고 details 를 노출하지 않는다`() {
        mvc.get("/actuator/health").andExpect {
            status { isOk() }
            jsonPath("$.status") { exists() }
            jsonPath("$.details") { doesNotExist() }
            jsonPath("$.components") { doesNotExist() }
        }
    }

    @Test
    fun `prod 에서도 민감 actuator endpoint 는 200 으로 노출되지 않는다`() {
        listOf("/actuator/env", "/actuator/beans", "/actuator/configprops", "/actuator/mappings").forEach { path ->
            val status = mvc.get(path).andReturn().response.status
            assertNotEquals(200, status, "$path 는 prod 에서도 노출되면 안 된다(200 금지)")
        }
    }
}

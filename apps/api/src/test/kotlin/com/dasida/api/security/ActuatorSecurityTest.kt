package com.dasida.api.security

import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

/**
 * Actuator 노출 정책 검증(default/test 프로파일).
 * - /actuator/health 만 공개하며 details/components 는 노출하지 않는다.
 * - env/beans/configprops/mappings 등 민감 endpoint 는 200 으로 노출되지 않는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ActuatorSecurityTest(
    @Autowired private val mvc: MockMvc,
) {
    @Test
    fun `health 는 인증 없이 200 이고 status 만 노출한다`() {
        mvc.get("/actuator/health").andExpect {
            status { isOk() }
            jsonPath("$.status") { exists() }
            jsonPath("$.details") { doesNotExist() }
            jsonPath("$.components") { doesNotExist() }
        }
    }

    @Test
    fun `민감 actuator endpoint 는 200 으로 노출되지 않는다`() {
        SENSITIVE_ENDPOINTS.forEach { path ->
            val status = mvc.get(path).andReturn().response.status
            assertNotEquals(200, status, "$path 는 외부에 노출되면 안 된다(200 금지)")
        }
    }

    companion object {
        private val SENSITIVE_ENDPOINTS = listOf(
            "/actuator/env",
            "/actuator/beans",
            "/actuator/configprops",
            "/actuator/mappings",
            "/actuator/metrics",
            "/actuator/loggers",
            "/actuator/threaddump",
            "/actuator/heapdump",
        )
    }
}

package com.dasida.api.security

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import kotlin.test.assertTrue

@SpringBootTest
@AutoConfigureMockMvc
class ActuatorSecurityTest(@Autowired val mvc: MockMvc) {

    @Test
    fun `health 는 공개되어 200`() {
        mvc.get("/actuator/health").andExpect { status { isOk() } }
    }

    @Test
    fun `health 외 actuator endpoint 는 공개되지 않는다`() {
        // 미노출(404)이든 인증필요(401)든 OK. 핵심은 200 공개가 아니어야 함.
        for (path in listOf("/actuator/env", "/actuator/beans")) {
            val status = mvc.get(path).andReturn().response.status
            assertTrue(status != 200, "$path 가 공개(200)되면 안 됨, 실제=$status")
        }
    }
}

package com.dasida.api.security

import com.dasida.api.auth.User
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@SpringBootTest
@AutoConfigureMockMvc
class JwtAuthenticationBoundaryTest(
    @param:Autowired private val mvc: MockMvc,
) {
    @Test
    fun `잘못된 Authorization 형식과 malformed Bearer는 내부 정보 없이 401`() {
        listOf(
            "Bearer",
            "Bearer ",
            "Token token-value",
            "Bearer malformed-token",
        ).forEach(::assertUnauthorized)
    }

    @Test
    fun `다른 secret으로 서명한 활성 사용자 토큰은 내부 정보 없이 401`() {
        val forgedJwt = JwtService(
            "forged-test-secret-that-is-at-least-32-bytes!!",
            86_400_000,
            "",
        )
        val forgedToken = forgedJwt.issue(
            User(id = 1, email = "test-user-1@dasida.local", passwordHash = "x", name = "테스트 사용자 1"),
        )

        assertUnauthorized("Bearer $forgedToken")
    }

    private fun assertUnauthorized(authorization: String) {
        val response = mvc.get("/api/auth/me") {
            headers { add("Authorization", authorization) }
        }.andExpect {
            status { isUnauthorized() }
        }.andReturn().response

        assertThat(response.contentAsString).isBlank()
        assertThat(response.errorMessage).isNull()
    }
}

package com.dasida.api.validation

import com.dasida.api.auth.User
import com.dasida.api.security.JwtService
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post

@SpringBootTest
@AutoConfigureMockMvc
class RequestValidationBoundaryTest(
    @Autowired private val mockMvc: MockMvc,
    @Autowired private val jwtService: JwtService,
) {
    private val token: String by lazy {
        jwtService.issue(
            User(
                id = 1L,
                email = "test@dasida.local",
                passwordHash = "unused",
                name = "테스트 사용자",
            ),
        )
    }

    @Test
    fun `도메인별 필수 요청 필드가 누락되면 400을 반환한다`() {
        val requests =
            listOf(
                Request("/api/auth/signup", """{"password":"Password1!","name":"사용자"}""", false),
                Request("/api/posts", """{"images":[],"tags":[]}"""),
                Request("/api/campaigns", """{"capacity":10}"""),
                Request("/api/reports", """{"targetType":"POST","targetId":"post-1"}"""),
            )

        requests.forEach { request ->
            mockMvc
                .post(request.path) {
                    contentType = MediaType.APPLICATION_JSON
                    content = request.body
                    if (request.authenticated) {
                        header("Authorization", "Bearer $token")
                    }
                }.andExpect {
                    status { isBadRequest() }
                }
        }
    }

    private data class Request(
        val path: String,
        val body: String,
        val authenticated: Boolean = true,
    )
}

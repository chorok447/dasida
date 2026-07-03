package com.dasida.api.common

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

/**
 * OpenAPI 문서 자동화 smoke test. springdoc 내부 JSON 세부 구조에 과하게 의존하지 않고,
 * 문서가 뜨는지 / 제목·주요 path·bearerAuth scheme 가 포함되는지 정도만 확인한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class OpenApiDocsTest(
    @param:Autowired private val mvc: MockMvc,
) {
    @Test
    fun `OpenAPI JSON 은 제목과 주요 path, bearerAuth scheme 를 포함한다`() {
        mvc.get("/v3/api-docs").andExpect {
            status { isOk() }
            jsonPath("$.info.title") { value("Dasida API") }
            jsonPath("$.components.securitySchemes.bearerAuth.scheme") { value("bearer") }
            jsonPath("$.paths['/api/auth/login']") { exists() }
            jsonPath("$.paths['/api/auth/me']") { exists() }
            jsonPath("$.paths['/api/posts']") { exists() }
            jsonPath("$.paths['/api/posts/search']") { exists() }
            jsonPath("$.paths['/api/campaigns']") { exists() }
            jsonPath("$.paths['/api/campaigns/search']") { exists() }
            jsonPath("$.paths['/api/notifications']") { exists() }
            jsonPath("$.paths['/api/reports']") { exists() }
        }
    }

    @Test
    fun `Swagger UI index 에 인증 없이 접근할 수 있다`() {
        mvc.get("/swagger-ui/index.html").andExpect {
            status { isOk() }
        }
    }
}

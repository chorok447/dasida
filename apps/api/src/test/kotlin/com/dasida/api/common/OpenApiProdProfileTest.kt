package com.dasida.api.common

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

/**
 * prod 프로파일에서는 OpenAPI/Swagger 문서가 노출되지 않아야 한다(application-prod.yml 의 springdoc 비활성화).
 *
 * JwtService 는 prod 프로파일 + dev 플레이스홀더 시크릿 조합에서 기동을 거부한다. 여기서는 그 guard 를
 * 약화하지 않고, 테스트용으로 충분히 긴 안전한(=dev-insecure 로 시작하지 않는) 더미 시크릿만 주입한다.
 *
 * 또한 prod 프로파일은 CORS guard(CorsProperties.assertProdSafe)도 통과해야 기동하므로, 명시 https origin 을
 * 함께 주입한다. (dev localhost 를 상속하지 않는 prod 정책 확인은 CorsProdProfileTest 가 담당.)
 */
@SpringBootTest(
    properties = [
        "app.jwt.secret=test-prod-secret-that-is-long-enough-for-tests-1234567890",
        "app.cors.allowed-origins=https://app.example.com",
        // prod 는 Redis host 미주입 시 기동 실패(fail-fast). 이 테스트 주제가 아니므로 placeholder 만 해결한다.
        "spring.data.redis.host=localhost",
    ],
)
@AutoConfigureMockMvc
@ActiveProfiles("prod")
class OpenApiProdProfileTest(
    @param:Autowired private val mvc: MockMvc,
) {
    @Test
    fun `prod 프로파일에서 OpenAPI JSON 은 노출되지 않는다`() {
        mvc.get("/v3/api-docs").andExpect {
            status { isNotFound() }
        }
    }

    @Test
    fun `prod 프로파일에서 Swagger UI 는 노출되지 않는다`() {
        mvc.get("/swagger-ui/index.html").andExpect {
            status { isNotFound() }
        }
    }
}

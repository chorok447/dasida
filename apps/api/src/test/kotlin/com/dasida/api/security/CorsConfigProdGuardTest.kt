package com.dasida.api.security

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.assertThrows
import org.springframework.mock.env.MockEnvironment

/**
 * CorsConfig 가 prod CORS guard 를 "prod 프로파일에서만" 실제로 적용하는지(배선) 검증한다.
 * guard 로직 자체(빈값/`*`/localhost 판정)는 CorsPropertiesTest 가 담당하므로 여기서는 프로파일 게이팅만 본다.
 * Spring 컨텍스트 없이 @Bean 메서드를 직접 호출한다(JwtServiceTest 와 동일 스타일).
 */
class CorsConfigProdGuardTest {
    private val config = CorsConfig()

    private fun env(vararg profiles: String) = MockEnvironment().apply { setActiveProfiles(*profiles) }

    @Test
    fun `prod 프로파일에서 위험한 origin 이면 corsConfigurationSource 생성이 실패한다`() {
        val dangerous = listOf(
            emptyList(),
            listOf("*"),
            listOf("http://localhost:3000"),
            listOf("http://127.0.0.1:3000"),
        )
        for (origins in dangerous) {
            assertThrows<IllegalStateException>("prod + $origins 는 기동 실패해야 함") {
                config.corsConfigurationSource(CorsProperties(allowedOrigins = origins), env("prod"))
            }
        }
    }

    @Test
    fun `prod 프로파일에서 명시 https origin 이면 생성에 성공한다`() {
        assertDoesNotThrow {
            config.corsConfigurationSource(
                CorsProperties(allowedOrigins = listOf("https://app.example.com")),
                env("prod"),
            )
        }
    }

    @Test
    fun `비prod 프로파일에서는 localhost origin 이어도 guard 를 적용하지 않는다`() {
        assertDoesNotThrow {
            config.corsConfigurationSource(CorsProperties(allowedOrigins = listOf("http://localhost:3000")), env())
            config.corsConfigurationSource(CorsProperties(allowedOrigins = listOf("http://localhost:3000")), env("dev", "test"))
            // preprod 는 prod 부분일치일 뿐 prod 가 아니므로 guard 미적용
            config.corsConfigurationSource(CorsProperties(allowedOrigins = listOf("http://localhost:3000")), env("preprod"))
        }
    }
}

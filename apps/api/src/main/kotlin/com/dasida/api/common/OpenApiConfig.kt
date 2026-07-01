package com.dasida.api.common

import io.swagger.v3.oas.models.Components
import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.info.Info
import io.swagger.v3.oas.models.security.SecurityScheme
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * OpenAPI 3 문서 메타데이터와 인증 scheme 정의.
 *
 * 실제 API 계약(path/DTO/status)은 Controller/DTO 에서 springdoc 이 자동 반영한다. 여기서는 문서 제목과
 * JWT Bearer 인증 scheme("bearerAuth")만 선언한다. public GET 과 인증 필수 API 가 섞여 있으므로 전역
 * SecurityRequirement 는 두지 않고, 인증이 필요한 operation 에만 `@SecurityRequirement(name = "bearerAuth")`
 * 를 붙여 표시한다.
 */
@Configuration
class OpenApiConfig {

    @Bean
    fun dasidaOpenAPI(): OpenAPI =
        OpenAPI()
            .info(
                Info()
                    .title("Dasida API")
                    .version("1.0.0")
                    .description("다시,다(Dasida) 백엔드 API 문서"),
            )
            .components(
                Components()
                    .addSecuritySchemes(
                        "bearerAuth",
                        SecurityScheme()
                            .type(SecurityScheme.Type.HTTP)
                            .scheme("bearer")
                            .bearerFormat("JWT")
                            .description("로그인/회원가입으로 발급받은 JWT 를 'Bearer <token>' 형식으로 전달"),
                    ),
            )
}

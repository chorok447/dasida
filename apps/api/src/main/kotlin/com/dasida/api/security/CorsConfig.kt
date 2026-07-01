package com.dasida.api.security

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.env.Environment
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

/**
 * CORS 정책을 property(app.cors) 기반으로 구성한다. Spring Security 의 .cors{} 가 이름이
 * "corsConfigurationSource" 인 bean 을 자동으로 사용한다. 등록 범위는 기존과 동일하게 api 하위 경로다.
 *
 * prod 프로파일에서는 [CorsProperties.assertProdSafe] 로 위험한 origin 설정 시 기동을 실패시킨다.
 */
@Configuration
@EnableConfigurationProperties(CorsProperties::class)
class CorsConfig {

    @Bean
    fun corsConfigurationSource(
        props: CorsProperties,
        environment: Environment,
    ): CorsConfigurationSource {
        // JwtService 와 동일한 방식으로 comma-separated 프로파일에서 "prod" 정확 일치만 prod 로 판정.
        val isProd = environment.activeProfiles.any { it.trim() == "prod" }
        if (isProd) {
            props.assertProdSafe()
        }

        val cfg = CorsConfiguration().apply {
            allowedOrigins = props.sanitizedOrigins()
            allowedMethods = props.allowedMethods
            allowedHeaders = props.allowedHeaders
            exposedHeaders = props.exposedHeaders
            allowCredentials = props.allowCredentials
            maxAge = props.maxAge
        }
        return UrlBasedCorsConfigurationSource().apply { registerCorsConfiguration("/api/**", cfg) }
    }
}

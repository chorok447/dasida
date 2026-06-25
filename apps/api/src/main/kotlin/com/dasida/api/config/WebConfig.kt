package com.dasida.api.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.CorsRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@Configuration
class WebConfig(
    @Value("\${app.web-origin}") private val webOrigin: String,
) : WebMvcConfigurer {
    // ponytail: 단일 origin 설정값만 허용. 와일드카드 금지(신뢰 경계).
    override fun addCorsMappings(registry: CorsRegistry) {
        registry.addMapping("/api/**")
            .allowedOrigins(webOrigin)
            .allowedMethods("GET", "POST", "PUT", "DELETE")
    }
}

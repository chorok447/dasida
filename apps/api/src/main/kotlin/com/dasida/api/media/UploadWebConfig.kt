package com.dasida.api.media

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.http.CacheControl
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import java.nio.file.Paths
import java.time.Duration

@Configuration
class UploadWebConfig(
    @param:Value("\${app.upload.dir:uploads}") private val uploadDir: String,
) : WebMvcConfigurer {
    override fun addResourceHandlers(registry: ResourceHandlerRegistry) {
        val location = Paths.get(uploadDir).toAbsolutePath().normalize().toUri().toString()
        registry.addResourceHandler("/uploads/**")
            .addResourceLocations("$location/")
            // 파일명이 UUID 기반이라 URL 당 내용이 불변 — 브라우저가 피드 재방문마다
            // 재검증/재다운로드하지 않도록 장기 immutable 캐싱(썸네일·원본 공통).
            .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
    }
}

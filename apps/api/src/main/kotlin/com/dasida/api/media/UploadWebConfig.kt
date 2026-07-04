package com.dasida.api.media

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import java.nio.file.Paths

@Configuration
class UploadWebConfig(
    @param:Value("\${app.upload.dir:uploads}") private val uploadDir: String,
) : WebMvcConfigurer {
    override fun addResourceHandlers(registry: ResourceHandlerRegistry) {
        val location = Paths.get(uploadDir).toAbsolutePath().normalize().toUri().toString()
        registry.addResourceHandler("/uploads/**")
            .addResourceLocations("$location/")
    }
}

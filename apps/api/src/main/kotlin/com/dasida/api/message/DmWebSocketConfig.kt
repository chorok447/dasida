package com.dasida.api.message

import com.dasida.api.security.CorsProperties
import org.springframework.context.annotation.Configuration
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry

@Configuration
@EnableWebSocket
class DmWebSocketConfig(
    private val handler: DmWebSocketHandler,
    private val auth: DmHandshakeInterceptor,
    private val cors: CorsProperties,
) : WebSocketConfigurer {
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(handler, "/ws/messages")
            .addInterceptors(auth)
            .setAllowedOrigins(*cors.sanitizedOrigins().toTypedArray())
    }
}

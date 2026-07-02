package com.dasida.api.security

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 환경별 CORS 정책. prefix=app.cors 로 바인딩한다.
 *
 * 기본값은 local/dev/test 용(Next.js 개발 서버 origin). prod 에서는 반드시 명시 origin 을 주입해야 하며,
 * 위험한 값(빈 값 / '*' / localhost)은 [assertProdSafe] 로 기동 시점에 차단한다.
 */
@ConfigurationProperties(prefix = "app.cors")
data class CorsProperties(
    val allowedOrigins: List<String> = listOf("http://localhost:3000", "http://127.0.0.1:3000"),
    val allowedMethods: List<String> = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS"),
    val allowedHeaders: List<String> = listOf("Authorization", "Content-Type", "Accept"),
    val exposedHeaders: List<String> = emptyList(),
    val allowCredentials: Boolean = true,
    val maxAge: Long = 3600,
) {
    /** 공백/빈 항목을 제거한 실제 origin 목록. */
    fun sanitizedOrigins(): List<String> = allowedOrigins.map { it.trim() }.filter { it.isNotEmpty() }

    /**
     * prod 프로파일 전용 안전성 검증. 위반 시 IllegalStateException 으로 기동을 실패시킨다.
     * - origin 미지정(빈 값) 금지: 실수로 무제한/무설정 배포 방지
     * - '*' wildcard 금지: credentials 동반 시 브라우저가 거부하고, 신뢰 경계가 사라짐
     * - localhost/127.0.0.1 금지: dev origin 이 운영에 남는 것 방지
     */
    fun assertProdSafe() {
        val origins = sanitizedOrigins()
        check(origins.isNotEmpty()) {
            "prod CORS: app.cors.allowed-origins must be set (e.g. APP_CORS_ALLOWED_ORIGINS). Refusing to start."
        }
        check(!origins.contains("*")) {
            "prod CORS: wildcard '*' origin is not allowed in production. Set explicit origins."
        }
        check(!(allowCredentials && origins.contains("*"))) {
            "prod CORS: allow-credentials=true cannot be combined with wildcard '*' origin."
        }
        val loopback = origins.filter { it.contains("localhost") || it.contains("127.0.0.1") }
        check(loopback.isEmpty()) {
            "prod CORS: localhost/loopback origins are not allowed in production: $loopback"
        }
    }
}

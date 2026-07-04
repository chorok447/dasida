package com.dasida.api.security

import jakarta.servlet.http.HttpServletRequest
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.ResponseCookie
import org.springframework.stereotype.Component
import java.time.Duration

/**
 * JWT 를 담는 httpOnly 세션 쿠키 발급/만료.
 * - HttpOnly: JS(XSS)에서 토큰을 읽을 수 없다. 프론트는 토큰을 localStorage 에 저장하지 않는다.
 * - SameSite=Lax: cross-site POST 에 쿠키가 실리지 않아 CSRF 기본 방어(CORS origin 제한과 병행).
 *   web(:3000)과 api(:8080)는 같은 site 여야 쿠키가 전송된다(로컬 localhost, 운영은 같은 도메인의 서브도메인).
 * - Secure: HTTPS 전용. 로컬 http 개발을 위해 프로퍼티(app.jwt.cookie-secure)로 제어하고 prod 는 true.
 */
@Component
class AuthCookies(
    @param:Value("\${app.jwt.ttl-millis}") private val ttlMillis: Long,
    @param:Value("\${app.jwt.cookie-secure:false}") private val secure: Boolean,
) {
    fun issue(token: String): ResponseCookie = builder(token).maxAge(Duration.ofMillis(ttlMillis)).build()

    fun expire(): ResponseCookie = builder("").maxAge(Duration.ZERO).build()

    private fun builder(value: String): ResponseCookie.ResponseCookieBuilder =
        ResponseCookie.from(NAME, value)
            .httpOnly(true)
            .secure(secure)
            .sameSite("Lax")
            .path("/")

    companion object {
        const val NAME = "dasida_token"
    }
}

/** 요청의 인증 쿠키 값. 없거나 비어 있으면 null. */
fun HttpServletRequest.authCookieToken(): String? =
    cookies?.firstOrNull { it.name == AuthCookies.NAME }?.value?.takeIf { it.isNotBlank() }

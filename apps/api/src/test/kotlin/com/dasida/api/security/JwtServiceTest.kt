package com.dasida.api.security

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertFalse

/** prod 가드만 검증. Spring 컨텍스트 없이 생성자 직접 호출. */
class JwtServiceTest {

    @Test
    fun `prod 에서 dev 기본 시크릿이면 기동 실패`() {
        assertThrows<IllegalArgumentException> {
            JwtService("dev-insecure-secret-change-me-32bytes-minimum!!", 86400000, "prod")
        }
    }

    @Test
    fun `prod 라도 실제 시크릿이면 통과`() {
        val svc = JwtService("a-real-and-sufficiently-long-production-secret!!", 86400000, "prod")
        assertFalse(svc.issue(com.dasida.api.auth.User(1, "e@x.com", "h", "n", false)).isBlank())
    }

    @Test
    fun `프로파일 없으면 dev 기본값도 통과`() {
        JwtService("dev-insecure-secret-change-me-32bytes-minimum!!", 86400000, "")
    }
}

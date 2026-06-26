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

    private val devSecret = "dev-insecure-secret-change-me-32bytes-minimum!!"

    @Test
    fun `comma-separated 프로파일에 prod 가 정확히 있으면 prod 로 판정해 기동 실패`() {
        for (profiles in listOf("prod", "local,prod", "dev, prod")) {
            assertThrows<IllegalArgumentException>("'$profiles' 는 prod 로 판정되어야 함") {
                JwtService(devSecret, 86400000, profiles)
            }
        }
    }

    @Test
    fun `prod 와 부분일치하는 프로파일은 prod 가 아니라 통과`() {
        // preprod / nonprod / 빈 문자열은 prod 아님 → dev 시크릿이어도 기동 OK
        for (profiles in listOf("preprod", "nonprod", "")) {
            JwtService(devSecret, 86400000, profiles)
        }
    }
}

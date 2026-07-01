package com.dasida.api.security

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals

/**
 * prod CORS guard 단위 테스트. context 를 띄우지 않고 [CorsProperties.assertProdSafe] 만 검증한다.
 */
class CorsPropertiesTest {

    @Test
    fun `prod 는 origin 미지정이면 기동 실패`() {
        assertThrows<IllegalStateException> {
            CorsProperties(allowedOrigins = emptyList()).assertProdSafe()
        }
    }

    @Test
    fun `prod 는 빈 문자열만 있으면 기동 실패`() {
        assertThrows<IllegalStateException> {
            CorsProperties(allowedOrigins = listOf("", "   ")).assertProdSafe()
        }
    }

    @Test
    fun `prod 는 wildcard origin 이면 기동 실패`() {
        assertThrows<IllegalStateException> {
            CorsProperties(allowedOrigins = listOf("*")).assertProdSafe()
        }
    }

    @Test
    fun `prod 는 localhost origin 이면 기동 실패`() {
        assertThrows<IllegalStateException> {
            CorsProperties(allowedOrigins = listOf("http://localhost:3000")).assertProdSafe()
        }
        assertThrows<IllegalStateException> {
            CorsProperties(allowedOrigins = listOf("http://127.0.0.1:3000")).assertProdSafe()
        }
    }

    @Test
    fun `prod 는 명시 https origin 이면 통과`() {
        val props = CorsProperties(allowedOrigins = listOf(" https://app.example.com "))
        props.assertProdSafe()
        assertEquals(listOf("https://app.example.com"), props.sanitizedOrigins())
    }
}

package com.dasida.api.common

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException
import kotlin.test.assertEquals

/**
 * 공통 page/size 검증 helper 단위 테스트. Spring 컨텍스트 없이 함수만 직접 호출한다.
 * status(400)와 message 문구가 기존 각 서비스가 던지던 것과 동일함을 고정한다.
 */
class PagePolicyTest {

    @Test
    fun `page 0 과 경계 size 는 통과한다`() {
        checkPageParams(page = 0, size = 1, maxSize = 100)
        checkPageParams(page = 0, size = 100, maxSize = 100)
        checkPageParams(page = 5, size = 50, maxSize = 50)
    }

    @Test
    fun `음수 page 는 400 과 기존 메시지`() {
        val ex = assertThrows<ResponseStatusException> { checkPageParams(page = -1, size = 10, maxSize = 100) }
        assertEquals(HttpStatus.BAD_REQUEST, ex.statusCode)
        assertEquals("page must not be negative", ex.reason)
    }

    @Test
    fun `size 0 은 400 과 기존 메시지`() {
        val ex = assertThrows<ResponseStatusException> { checkPageParams(page = 0, size = 0, maxSize = 100) }
        assertEquals(HttpStatus.BAD_REQUEST, ex.statusCode)
        assertEquals("size must be between 1 and 100", ex.reason)
    }

    @Test
    fun `size 가 maxSize 를 넘으면 400 과 기존 메시지`() {
        val ex = assertThrows<ResponseStatusException> { checkPageParams(page = 0, size = 101, maxSize = 100) }
        assertEquals(HttpStatus.BAD_REQUEST, ex.statusCode)
        assertEquals("size must be between 1 and 100", ex.reason)
    }

    @Test
    fun `maxSize 는 도메인별 값을 그대로 메시지에 쓴다`() {
        val ex = assertThrows<ResponseStatusException> { checkPageParams(page = 0, size = 51, maxSize = 50) }
        assertEquals("size must be between 1 and 50", ex.reason)
    }

    @Test
    fun `checkPageSize 는 size 만 검증한다`() {
        checkPageSize(size = 1, maxSize = 50)
        checkPageSize(size = 50, maxSize = 50)

        val tooLarge = assertThrows<ResponseStatusException> { checkPageSize(size = 51, maxSize = 50) }
        assertEquals(HttpStatus.BAD_REQUEST, tooLarge.statusCode)
        assertEquals("size must be between 1 and 50", tooLarge.reason)

        val zero = assertThrows<ResponseStatusException> { checkPageSize(size = 0, maxSize = 50) }
        assertEquals(HttpStatus.BAD_REQUEST, zero.statusCode)
    }
}

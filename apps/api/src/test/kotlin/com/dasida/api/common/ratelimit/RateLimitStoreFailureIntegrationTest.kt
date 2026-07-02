package com.dasida.api.common.ratelimit

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional

/**
 * rate limit store 장애(예: Redis 다운) 시 요청이 5xx 로 실패하지 않고
 * 기존 비즈니스 흐름으로 진행되는지(fail-open) 필터 경유로 검증한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RateLimitStoreFailureIntegrationTest(
    @param:Autowired val mvc: MockMvc,
) {
    @TestConfiguration
    class ThrowingRateLimitStoreConfig {
        @Bean
        @Primary
        fun throwingRateLimitStore(): RateLimitBucketStore = object : RateLimitBucketStore {
            override fun tryConsume(key: String, limit: Int, windowSeconds: Long): RateLimitResult =
                throw RuntimeException("store down")
        }
    }

    @Test
    fun `store 장애여도 signup 은 5xx 가 아니라 정상 처리된다`() {
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"failopen-signup@dasida.com","password":"password1!","name":"페일오픈"}"""
        }.andExpect { status { isCreated() } }
    }

    @Test
    fun `store 장애여도 login 은 5xx 가 아니라 인증 흐름으로 진행된다`() {
        // 없는 사용자 → rate limit 을 통과해 인증 로직까지 도달했으면 401(5xx 아님)
        mvc.post("/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"failopen-nouser@dasida.com","password":"password1!"}"""
        }.andExpect { status { isUnauthorized() } }
    }
}

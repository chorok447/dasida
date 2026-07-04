package com.dasida.api.infrastructure

import com.dasida.api.common.ratelimit.RateLimitBucketStore
import com.dasida.api.common.ratelimit.RedisRateLimitBucketStore
import com.dasida.api.security.RedisTokenDenylistStore
import com.dasida.api.security.TokenDenylistStore
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles

/**
 * prod 프로파일이 denylist·rate limit store 를 in-memory 가 아닌 Redis 구현으로 wiring 하는지 검증한다.
 * (in-memory 는 인스턴스 로컬 + 재기동 시 소실이라 prod 에 부적합 — redis-security-store-policy.md.)
 * 빈 wiring 만 확인하며 실제 Redis 연결은 필요 없다(Lettuce 는 lazy connect).
 */
@SpringBootTest(
    properties = [
        "app.jwt.secret=test-prod-secret-that-is-long-enough-for-tests-1234567890",
        "app.cors.allowed-origins=https://app.example.com",
        "spring.data.redis.host=localhost",
    ],
)
@ActiveProfiles("prod")
class ProdRedisStoreConfigTest(
    @param:Autowired private val denylistStore: TokenDenylistStore,
    @param:Autowired private val rateLimitStore: RateLimitBucketStore,
) {
    @Test
    fun `prod denylist store 는 Redis 구현이다`() {
        assertThat(denylistStore).isInstanceOf(RedisTokenDenylistStore::class.java)
    }

    @Test
    fun `prod rate limit store 는 Redis 구현이다`() {
        assertThat(rateLimitStore).isInstanceOf(RedisRateLimitBucketStore::class.java)
    }
}

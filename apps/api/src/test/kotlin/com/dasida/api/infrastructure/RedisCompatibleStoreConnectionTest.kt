package com.dasida.api.infrastructure

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.test.context.ActiveProfiles

/**
 * Redis-compatible store(Valkey) 연결 smoke test.
 * CI 기본 test run 에서는 Redis 가 없으므로 비활성. compose 기동 후:
 * `REDIS_SMOKE=true ./gradlew test --tests RedisCompatibleStoreConnectionTest`
 */
@SpringBootTest
@ActiveProfiles("local")
@EnabledIfEnvironmentVariable(named = "REDIS_SMOKE", matches = "true")
class RedisCompatibleStoreConnectionTest(
    @param:Autowired private val redis: StringRedisTemplate,
) {
    @Test
    fun `set and get round-trip`() {
        redis.opsForValue().set("dasida:redis-smoke", "ok")
        assertThat(redis.opsForValue().get("dasida:redis-smoke")).isEqualTo("ok")
    }
}

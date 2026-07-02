package com.dasida.api.common.ratelimit

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class RateLimitServiceTest {
    @Test
    fun `limit 이내면 허용하고 초과하면 거부한다`() {
        val store = RecordingRateLimitBucketStore()
        val service =
            RateLimitService(
                RateLimitProperties(
                    enabled = true,
                    auth =
                        AuthRateLimitRules(
                            login = RateLimitRuleConfig(limit = 2, windowSeconds = 60),
                        ),
                ),
                store,
            )

        assertThat(service.check(RateLimitRule.AUTH_LOGIN, "203.0.113.1").allowed).isTrue()
        assertThat(service.check(RateLimitRule.AUTH_LOGIN, "203.0.113.1").allowed).isTrue()
        assertThat(service.check(RateLimitRule.AUTH_LOGIN, "203.0.113.1").allowed).isFalse()
        assertThat(store.calls).hasSize(3)
    }

    @Test
    fun `비활성화 시 store를 호출하지 않고 허용한다`() {
        val store = RecordingRateLimitBucketStore()
        val service = RateLimitService(RateLimitProperties(enabled = false), store)

        repeat(3) {
            assertThat(service.check(RateLimitRule.AUTH_SIGNUP, "203.0.113.2").allowed).isTrue()
        }
        assertThat(store.calls).isEmpty()
    }
}

private class RecordingRateLimitBucketStore : RateLimitBucketStore {
    val calls = mutableListOf<String>()
    private val counts = mutableMapOf<String, Int>()

    override fun tryConsume(key: String, limit: Int, windowSeconds: Long): RateLimitResult {
        calls += key
        val count = counts.merge(key, 1) { left, _ -> left + 1 }!!
        val allowed = count <= limit
        return RateLimitResult(
            allowed = allowed,
            limit = limit,
            remaining = (limit - count).coerceAtLeast(0),
            retryAfterSeconds = if (allowed) 0 else windowSeconds,
        )
    }
}

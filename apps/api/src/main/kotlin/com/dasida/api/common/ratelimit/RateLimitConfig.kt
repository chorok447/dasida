package com.dasida.api.common.ratelimit

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.Ordered
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

@Configuration
@EnableConfigurationProperties(RateLimitProperties::class)
class RateLimitConfig {
    @Bean
    fun authRateLimitFilterRegistration(filter: AuthRateLimitFilter): FilterRegistrationBean<AuthRateLimitFilter> =
        FilterRegistrationBean(filter).apply {
            order = Ordered.HIGHEST_PRECEDENCE + 50
            addUrlPatterns("/api/auth/login", "/api/auth/signup")
        }

    @Bean
    fun contentWriteRateLimitFilterRegistration(
        filter: ContentWriteRateLimitFilter,
    ): FilterRegistrationBean<ContentWriteRateLimitFilter> =
        FilterRegistrationBean(filter).apply {
            order = Ordered.HIGHEST_PRECEDENCE + 51
            addUrlPatterns("/api/reports", "/api/posts/*", "/api/campaigns/*")
        }
}

@Component
@ConditionalOnProperty(prefix = "app.rate-limit", name = ["store"], havingValue = "redis")
class RedisRateLimitBucketStore(
    private val redis: StringRedisTemplate,
) : RateLimitBucketStore {
    override fun tryConsume(key: String, limit: Int, windowSeconds: Long): RateLimitResult {
        val count = redis.opsForValue().increment(key) ?: 1L
        if (count == 1L) {
            redis.expire(key, Duration.ofSeconds(windowSeconds))
        }
        val ttlSeconds = redis.getExpire(key, TimeUnit.SECONDS).coerceAtLeast(0)
        val allowed = count <= limit
        val remaining = (limit - count).coerceAtLeast(0).toInt()
        val retryAfter = if (allowed) 0L else ttlSeconds.coerceAtLeast(1)
        return RateLimitResult(
            allowed = allowed,
            limit = limit,
            remaining = remaining,
            retryAfterSeconds = retryAfter,
        )
    }
}

@Component
@ConditionalOnProperty(prefix = "app.rate-limit", name = ["store"], havingValue = "memory", matchIfMissing = true)
class InMemoryRateLimitBucketStore : RateLimitBucketStore {
    private data class Window(var count: Int, val resetAt: java.time.Instant)

    private val buckets = ConcurrentHashMap<String, Window>()

    override fun tryConsume(key: String, limit: Int, windowSeconds: Long): RateLimitResult {
        val now = java.time.Instant.now()
        val window =
            buckets.compute(key) { _, existing ->
                if (existing == null || !now.isBefore(existing.resetAt)) {
                    Window(count = 1, resetAt = now.plusSeconds(windowSeconds))
                } else {
                    existing.count += 1
                    existing
                }
            }!!
        val allowed = window.count <= limit
        val remaining = (limit - window.count).coerceAtLeast(0)
        val retryAfter =
            if (allowed) {
                0L
            } else {
                java.time.Duration.between(now, window.resetAt).seconds.coerceAtLeast(1)
            }
        return RateLimitResult(
            allowed = allowed,
            limit = limit,
            remaining = remaining,
            retryAfterSeconds = retryAfter,
        )
    }
}

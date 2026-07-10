package com.dasida.api.security

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.util.HexFormat
import java.util.concurrent.ConcurrentHashMap

/**
 * 로그아웃된 access token 을 만료 전까지 차단하는 denylist.
 * 원본 JWT 는 저장하지 않고 SHA-256 hash 만 key 로 쓴다. TTL 은 토큰 남은 만료 시간까지만 유지한다.
 * store 는 rate limit 과 동일한 패턴(app.auth.denylist.store=memory|redis)으로 전환한다.
 */
interface TokenDenylistStore {
    /** ttlSeconds <= 0(이미 만료) 이면 저장하지 않는다. */
    fun deny(tokenHash: String, ttlSeconds: Long)

    fun isDenied(tokenHash: String): Boolean

    /**
     * 원자적 set-if-absent. 새로 등록했으면 true, 이미 등록돼 있었으면 false.
     * refresh rotation 의 재사용 감지가 check-then-deny 두 단계로 갈라지면 같은 토큰의
     * 동시 요청이 둘 다 통과하는 창이 생긴다 — 그 창을 없애는 용도.
     * ttlSeconds <= 0(이미 만료된 토큰)은 등록할 것이 없으므로 true.
     */
    fun denyIfAbsent(tokenHash: String, ttlSeconds: Long): Boolean
}

/** raw JWT → SHA-256 hex. 원본 토큰을 저장/로그하지 않기 위한 단방향 해시. */
fun hashToken(token: String): String =
    HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.toByteArray()))

private fun redisKey(tokenHash: String) = "denylist:jwt:access:sha256:$tokenHash"

@Component
@ConditionalOnProperty(prefix = "app.auth.denylist", name = ["store"], havingValue = "redis")
class RedisTokenDenylistStore(
    private val redis: StringRedisTemplate,
) : TokenDenylistStore {
    override fun deny(tokenHash: String, ttlSeconds: Long) {
        if (ttlSeconds <= 0) return
        redis.opsForValue().set(redisKey(tokenHash), "1", Duration.ofSeconds(ttlSeconds))
    }

    override fun isDenied(tokenHash: String): Boolean = redis.hasKey(redisKey(tokenHash)) == true

    override fun denyIfAbsent(tokenHash: String, ttlSeconds: Long): Boolean {
        if (ttlSeconds <= 0) return true
        return redis.opsForValue().setIfAbsent(redisKey(tokenHash), "1", Duration.ofSeconds(ttlSeconds)) == true
    }
}

@Component
@ConditionalOnProperty(prefix = "app.auth.denylist", name = ["store"], havingValue = "memory", matchIfMissing = true)
class InMemoryTokenDenylistStore : TokenDenylistStore {
    // ponytail: dev/test 전용 store. 재조회되지 않는 항목은 프로세스 재시작까지 남지만, 실사용(local/prod)은 Redis store 다.
    private val denied = ConcurrentHashMap<String, Instant>()

    override fun deny(tokenHash: String, ttlSeconds: Long) {
        if (ttlSeconds <= 0) return
        denied[tokenHash] = Instant.now().plusSeconds(ttlSeconds)
    }

    override fun isDenied(tokenHash: String): Boolean {
        val expiresAt = denied[tokenHash] ?: return false
        if (!Instant.now().isBefore(expiresAt)) {
            denied.remove(tokenHash)
            return false
        }
        return true
    }

    override fun denyIfAbsent(tokenHash: String, ttlSeconds: Long): Boolean {
        if (ttlSeconds <= 0) return true
        val now = Instant.now()
        var inserted = false
        denied.compute(tokenHash) { _, existing ->
            if (existing != null && now.isBefore(existing)) {
                existing
            } else {
                inserted = true
                now.plusSeconds(ttlSeconds)
            }
        }
        return inserted
    }
}

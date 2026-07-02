package com.dasida.api.common.ratelimit

data class RateLimitResult(
    val allowed: Boolean,
    val limit: Int,
    val remaining: Int,
    val retryAfterSeconds: Long,
) {
    companion object {
        fun unlimited(limit: Int): RateLimitResult =
            RateLimitResult(allowed = true, limit = limit, remaining = limit, retryAfterSeconds = 0)
    }
}

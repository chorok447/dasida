package com.dasida.api.common.ratelimit

import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException

@Service
class RateLimitService(
    private val properties: RateLimitProperties,
    private val store: RateLimitBucketStore,
) {
    fun check(rule: RateLimitRule, clientIp: String): RateLimitResult {
        if (!properties.enabled) {
            return RateLimitResult.unlimited(ruleConfig(rule).limit)
        }
        val config = ruleConfig(rule)
        return store.tryConsume(rule.bucketKey(clientIp), config.limit, config.windowSeconds)
    }

    fun enforce(rule: RateLimitRule, clientIp: String) {
        val result = check(rule, clientIp)
        if (!result.allowed) {
            throw RateLimitExceededException(result.retryAfterSeconds)
        }
    }

    private fun ruleConfig(rule: RateLimitRule): RateLimitRuleConfig =
        when (rule) {
            RateLimitRule.AUTH_LOGIN -> properties.auth.login
            RateLimitRule.AUTH_SIGNUP -> properties.auth.signup
        }
}

class RateLimitExceededException(
    val retryAfterSeconds: Long,
) : ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "too many requests")

package com.dasida.api.common.ratelimit

import io.micrometer.core.instrument.MeterRegistry
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException

@Service
class RateLimitService(
    private val properties: RateLimitProperties,
    private val store: RateLimitBucketStore,
    private val meterRegistry: MeterRegistry,
) {
    private val log = LoggerFactory.getLogger(RateLimitService::class.java)

    fun check(rule: RateLimitRule, clientIp: String): RateLimitResult {
        if (!properties.enabled) {
            return RateLimitResult.unlimited(ruleConfig(rule).limit)
        }
        val config = ruleConfig(rule)
        return try {
            store.tryConsume(rule.bucketKey(clientIp), config.limit, config.windowSeconds)
        } catch (ex: Exception) {
            // fail-open: store(예: Redis) 장애로 제한을 확인할 수 없으면 요청을 막지 않는다(남용보다 가용성 우선).
            // rate limit 초과(RateLimitExceededException) 와 달리 store 장애는 통과시키고 metric·경고 로그만 남긴다.
            meterRegistry.counter(
                STORE_UNAVAILABLE_METRIC,
                "rule", rule.name,
                "policy", "fail_open",
            ).increment()
            // 로그에는 rule/policy 만 남긴다(client IP 전체값 등 민감정보 미출력).
            log.warn("rate limit store unavailable, failing open (rule={} policy=fail_open)", rule, ex)
            RateLimitResult.unlimited(config.limit)
        }
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
            RateLimitRule.COMMENT_CREATE -> properties.content.comment
            RateLimitRule.REPORT_CREATE -> properties.content.report
        }

    companion object {
        const val STORE_UNAVAILABLE_METRIC = "dasida.security.rate_limit.store_unavailable"
    }
}

class RateLimitExceededException(
    val retryAfterSeconds: Long,
) : ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "too many requests")

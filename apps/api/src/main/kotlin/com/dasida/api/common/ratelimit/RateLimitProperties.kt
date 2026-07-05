package com.dasida.api.common.ratelimit

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "app.rate-limit")
data class RateLimitProperties(
    val enabled: Boolean = true,
    /** `memory`(기본·테스트) 또는 `redis`(compose local). */
    val store: String = "memory",
    val auth: AuthRateLimitRules = AuthRateLimitRules(),
    val content: ContentWriteRateLimitRules = ContentWriteRateLimitRules(),
)

data class AuthRateLimitRules(
    val login: RateLimitRuleConfig = RateLimitRuleConfig(limit = 20, windowSeconds = 60),
    val signup: RateLimitRuleConfig = RateLimitRuleConfig(limit = 10, windowSeconds = 60),
)

data class ContentWriteRateLimitRules(
    val comment: RateLimitRuleConfig = RateLimitRuleConfig(limit = 20, windowSeconds = 60),
    val report: RateLimitRuleConfig = RateLimitRuleConfig(limit = 10, windowSeconds = 60),
    /** 업로드는 파일당 최대 5MB 디스크 쓰기라 댓글보다 보수적으로 제한한다. */
    val media: RateLimitRuleConfig = RateLimitRuleConfig(limit = 10, windowSeconds = 60),
)

data class RateLimitRuleConfig(
    val limit: Int = 10,
    val windowSeconds: Long = 60,
)

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
    /** 게시글은 댓글보다 무겁고(이미지 연결) 스팸 파급이 커서 절반 수준으로 제한한다. */
    val post: RateLimitRuleConfig = RateLimitRuleConfig(limit = 10, windowSeconds = 60),
    /** 캠페인 개설은 가장 무거운 콘텐츠라 보수적으로 제한한다. */
    val campaign: RateLimitRuleConfig = RateLimitRuleConfig(limit = 5, windowSeconds = 60),
    val report: RateLimitRuleConfig = RateLimitRuleConfig(limit = 10, windowSeconds = 60),
    /** 업로드는 파일당 최대 5MB 디스크 쓰기라 댓글보다 보수적으로 제한한다. */
    val media: RateLimitRuleConfig = RateLimitRuleConfig(limit = 10, windowSeconds = 60),
    /** 좋아요·북마크·팔로우류 토글. 가볍지만 알림을 만들 수 있어 봇 스팸을 막는다. */
    val interaction: RateLimitRuleConfig = RateLimitRuleConfig(limit = 60, windowSeconds = 60),
    /** 조회수 기록(비로그인 공개 POST). 봇의 조회수 부풀리기를 IP 단위로 완화한다. */
    val view: RateLimitRuleConfig = RateLimitRuleConfig(limit = 120, windowSeconds = 60),
)

data class RateLimitRuleConfig(
    val limit: Int = 10,
    val windowSeconds: Long = 60,
)

package com.dasida.api.common.ratelimit

enum class RateLimitRule(val keySegment: String) {
    AUTH_LOGIN("auth:login:ip"),
    AUTH_SIGNUP("auth:signup:ip"),
    COMMENT_CREATE("comment:create:ip"),
    REPORT_CREATE("report:create:ip"),
    ;

    fun bucketKey(clientIp: String): String = "rate-limit:$keySegment:$clientIp"
}

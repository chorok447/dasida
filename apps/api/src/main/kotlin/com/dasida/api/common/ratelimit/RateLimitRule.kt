package com.dasida.api.common.ratelimit

enum class RateLimitRule(val keySegment: String) {
    AUTH_LOGIN("auth:login:ip"),
    AUTH_SIGNUP("auth:signup:ip"),
    COMMENT_CREATE("comment:create:ip"),
    POST_CREATE("post:create:ip"),
    CAMPAIGN_CREATE("campaign:create:ip"),
    REPORT_CREATE("report:create:ip"),
    MEDIA_UPLOAD("media:upload:ip"),
    ;

    fun bucketKey(clientIp: String): String = "rate-limit:$keySegment:$clientIp"
}

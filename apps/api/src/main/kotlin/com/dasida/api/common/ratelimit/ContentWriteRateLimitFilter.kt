package com.dasida.api.common.ratelimit

import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpMethod
import org.springframework.stereotype.Component

@Component
class ContentWriteRateLimitFilter(
    rateLimitService: RateLimitService,
) : RateLimitFilterBase(rateLimitService) {
    override fun ruleFor(request: HttpServletRequest): RateLimitRule? {
        if (request.method != HttpMethod.POST.name()) return null
        val path = request.requestURI.removeSuffix("/")
        if (path == "/api/reports") return RateLimitRule.REPORT_CREATE
        if (path == "/api/media") return RateLimitRule.MEDIA_UPLOAD
        if (isCommentCreatePath(path)) return RateLimitRule.COMMENT_CREATE
        return null
    }

    private fun isCommentCreatePath(path: String): Boolean {
        val segments = path.split("/").filter { it.isNotEmpty() }
        if (segments.size != 4) return false
        return segments[0] == "api" &&
            segments[1] in setOf("posts", "campaigns") &&
            segments[3] == "comments"
    }
}

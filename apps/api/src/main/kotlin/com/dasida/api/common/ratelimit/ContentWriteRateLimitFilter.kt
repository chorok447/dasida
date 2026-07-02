package com.dasida.api.common.ratelimit

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class ContentWriteRateLimitFilter(
    private val rateLimitService: RateLimitService,
) : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val rule = ruleFor(request)
        if (rule == null) {
            filterChain.doFilter(request, response)
            return
        }

        try {
            rateLimitService.enforce(rule, clientIp(request))
        } catch (ex: RateLimitExceededException) {
            if (ex.retryAfterSeconds > 0) {
                response.setHeader("Retry-After", ex.retryAfterSeconds.toString())
            }
            response.sendError(HttpStatus.TOO_MANY_REQUESTS.value(), ex.reason)
            return
        }

        filterChain.doFilter(request, response)
    }

    private fun ruleFor(request: HttpServletRequest): RateLimitRule? {
        if (request.method != HttpMethod.POST.name()) return null
        val path = request.requestURI.removeSuffix("/")
        if (path == "/api/reports") return RateLimitRule.REPORT_CREATE
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

    private fun clientIp(request: HttpServletRequest): String {
        val forwarded = request.getHeader("X-Forwarded-For")
        if (!forwarded.isNullOrBlank()) {
            return forwarded.split(",").first().trim()
        }
        return request.remoteAddr ?: "unknown"
    }
}

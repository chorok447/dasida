package com.dasida.api.common.ratelimit

import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpMethod
import org.springframework.stereotype.Component

@Component
class AuthRateLimitFilter(
    rateLimitService: RateLimitService,
) : RateLimitFilterBase(rateLimitService) {
    override fun ruleFor(request: HttpServletRequest): RateLimitRule? {
        if (request.method != HttpMethod.POST.name()) return null
        val path = request.requestURI.removeSuffix("/")
        return when (path) {
            "/api/auth/login" -> RateLimitRule.AUTH_LOGIN
            "/api/auth/signup" -> RateLimitRule.AUTH_SIGNUP
            else -> null
        }
    }
}

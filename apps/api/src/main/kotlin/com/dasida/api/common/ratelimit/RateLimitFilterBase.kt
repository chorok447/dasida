package com.dasida.api.common.ratelimit

import com.dasida.api.common.clientIp
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.web.filter.OncePerRequestFilter

abstract class RateLimitFilterBase(
    private val rateLimitService: RateLimitService,
) : OncePerRequestFilter() {
    protected abstract fun ruleFor(request: HttpServletRequest): RateLimitRule?

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
}

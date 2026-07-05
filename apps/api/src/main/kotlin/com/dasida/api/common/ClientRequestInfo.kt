package com.dasida.api.common

import jakarta.servlet.http.HttpServletRequest

data class ClientRequestInfo(val ipAddress: String, val os: String) {
    companion object {
        fun from(request: HttpServletRequest): ClientRequestInfo =
            ClientRequestInfo(clientIp(request), parseClientOs(request.getHeader("User-Agent")))
    }
}

/**
 * rate limit·접속 기록이 공유하는 클라이언트 IP. X-Forwarded-For 첫 값을 신뢰하므로
 * XFF 를 덮어쓰는 신뢰 프록시(LB/리버스 프록시) 뒤 배치를 전제로 한다.
 * API 를 직접 노출하면 헤더 위조로 IP 기반 rate limit 이 우회될 수 있다.
 */
fun clientIp(request: HttpServletRequest): String {
    val forwarded = request.getHeader("X-Forwarded-For")
    if (!forwarded.isNullOrBlank()) {
        return forwarded.split(",").first().trim()
    }
    return request.remoteAddr ?: "unknown"
}

fun parseClientOs(userAgent: String?): String {
    if (userAgent.isNullOrBlank()) return "알 수 없음"
    return when {
        userAgent.contains("Windows", ignoreCase = true) -> "Windows"
        userAgent.contains("iPhone", ignoreCase = true) || userAgent.contains("iPad", ignoreCase = true) -> "iOS"
        userAgent.contains("Mac OS X", ignoreCase = true) -> "macOS"
        userAgent.contains("Android", ignoreCase = true) -> "Android"
        userAgent.contains("Linux", ignoreCase = true) -> "Linux"
        else -> "기타"
    }
}

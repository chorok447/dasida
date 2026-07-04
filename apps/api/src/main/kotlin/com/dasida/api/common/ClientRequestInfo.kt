package com.dasida.api.common

import jakarta.servlet.http.HttpServletRequest

data class ClientRequestInfo(val ipAddress: String, val os: String) {
    companion object {
        fun from(request: HttpServletRequest): ClientRequestInfo =
            ClientRequestInfo(clientIp(request), parseClientOs(request.getHeader("User-Agent")))
    }
}

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

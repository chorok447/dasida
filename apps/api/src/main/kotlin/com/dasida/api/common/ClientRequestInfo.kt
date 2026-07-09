package com.dasida.api.common

import jakarta.servlet.http.HttpServletRequest

data class ClientRequestInfo(val ipAddress: String, val os: String, val browser: String) {
    companion object {
        fun from(request: HttpServletRequest): ClientRequestInfo {
            val userAgent = request.getHeader("User-Agent")
            return ClientRequestInfo(clientIp(request), parseClientOs(userAgent), parseClientBrowser(userAgent))
        }
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

/**
 * User-Agent 의 대략적인 브라우저 구분. 파생 브라우저가 "Chrome"·"Safari" 토큰을 함께 실어 보내므로
 * 구체적인 것(Edge/Whale/삼성/Opera)부터 검사한다. 정확한 버전 식별이 아니라 접속 기록 표시용.
 */
fun parseClientBrowser(userAgent: String?): String {
    if (userAgent.isNullOrBlank()) return "알 수 없음"
    return when {
        userAgent.contains("Edg/", ignoreCase = true) || userAgent.contains("EdgA/", ignoreCase = true) -> "Edge"
        userAgent.contains("Whale", ignoreCase = true) -> "Whale"
        userAgent.contains("SamsungBrowser", ignoreCase = true) -> "Samsung Internet"
        userAgent.contains("OPR/", ignoreCase = true) || userAgent.contains("Opera", ignoreCase = true) -> "Opera"
        userAgent.contains("Firefox", ignoreCase = true) || userAgent.contains("FxiOS", ignoreCase = true) -> "Firefox"
        userAgent.contains("Chrome", ignoreCase = true) || userAgent.contains("CriOS", ignoreCase = true) -> "Chrome"
        userAgent.contains("Safari", ignoreCase = true) -> "Safari"
        else -> "기타"
    }
}

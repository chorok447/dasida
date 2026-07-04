package com.dasida.api.auth

import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException

private const val MAX_NAME_LENGTH = 30
private const val MAX_PROFILE_IMAGE_URL_LENGTH = 500

// ponytail: 형식 sanity 체크만(RFC 5322 아님). local@domain.tld 수준이면 통과.
private val EMAIL_RE = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")

// 프론트 회원가입 정책과 일치: 영문/숫자/특수문자 각 1개 이상, 8~15자.
private val PASSWORD_RE = Regex("^(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,15}$")

/** email trim/lowercase 후 형식 검증. 회원가입과 이메일 변경이 공유한다. */
fun normalizeEmail(rawEmail: String): String {
    val email = rawEmail.trim().lowercase()
    if (email.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "email is required")
    if (!email.matches(EMAIL_RE)) {
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid email format")
    }
    return email
}

/** name trim 후 길이 검증. 회원가입과 프로필 수정이 공유한다. */
fun normalizeName(rawName: String): String {
    val name = rawName.trim()
    if (name.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "name is required")
    if (name.length > MAX_NAME_LENGTH) {
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "name is too long")
    }
    return name
}

/** profileImageUrl trim 후 http(s) 형식 검증. null/blank 는 이미지 없음으로 처리한다. */
fun normalizeProfileImageUrl(rawUrl: String?): String? {
    if (rawUrl == null) return null
    val url = rawUrl.trim()
    if (url.isBlank()) return null
    if (url.length > MAX_PROFILE_IMAGE_URL_LENGTH) {
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "profile image url is too long")
    }
    val lower = url.lowercase()
    if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "profile image url must be http(s)")
    }
    if (!(url.startsWith("http://") || url.startsWith("https://"))) {
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "profile image url must be http(s)")
    }
    return url
}

/** password 정책 검증. 회원가입과 비밀번호 변경이 공유한다. */
fun validatePassword(password: String) {
    if (!password.matches(PASSWORD_RE)) {
        throw ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "password must be 8-15 chars with letters, digits and a special character",
        )
    }
}

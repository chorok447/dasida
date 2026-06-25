package com.dasida.api.security

/** JWT 에서 복원한 인증 주체. 컨트롤러에서 @AuthenticationPrincipal 로 주입. */
data class AuthUser(val id: Long, val name: String, val verified: Boolean)

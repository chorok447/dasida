package com.dasida.api.auth

import io.swagger.v3.oas.annotations.media.Schema

@Schema(description = "회원가입 요청")
data class SignupRequest(
    @field:Schema(description = "이메일", example = "user@example.com")
    val email: String,
    @field:Schema(description = "비밀번호", example = "Password1!")
    val password: String,
    @field:Schema(description = "표시 이름", example = "홍길동")
    val name: String,
)

@Schema(description = "로그인 요청")
data class LoginRequest(
    @field:Schema(description = "이메일", example = "user@example.com")
    val email: String,
    @field:Schema(description = "비밀번호", example = "Password1!")
    val password: String,
)

@Schema(description = "인증 응답. token 은 이후 요청에 Bearer 로 사용한다.")
data class AuthResponse(val token: String, val name: String, val verified: Boolean)

@Schema(description = "내 프로필")
data class UserProfileResponse(val id: Long, val email: String, val name: String, val verified: Boolean)

@Schema(description = "프로필 수정 요청")
data class UpdateProfileRequest(
    @field:Schema(description = "변경할 표시 이름", example = "홍길동")
    val name: String,
)

data class UpdateProfileResponse(val token: String, val profile: UserProfileResponse)

@Schema(description = "비밀번호 변경 요청")
data class ChangePasswordRequest(
    @field:Schema(description = "현재 비밀번호")
    val currentPassword: String,
    @field:Schema(description = "새 비밀번호", example = "Password1!")
    val newPassword: String,
)

data class ChangePasswordResponse(val changed: Boolean, val token: String?)

@Schema(description = "이메일 변경 요청")
data class ChangeEmailRequest(
    @field:Schema(description = "현재 비밀번호")
    val currentPassword: String,
    @field:Schema(description = "새 이메일", example = "new@example.com")
    val newEmail: String,
)

data class ChangeEmailResponse(val email: String, val name: String, val token: String)

@Schema(description = "계정 탈퇴 요청")
data class DeleteAccountRequest(
    @field:Schema(description = "현재 비밀번호")
    val currentPassword: String,
    @field:Schema(description = "확인 문구")
    val confirmText: String,
)

data class DeleteAccountResponse(val deleted: Boolean)

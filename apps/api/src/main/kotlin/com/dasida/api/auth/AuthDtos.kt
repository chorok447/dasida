package com.dasida.api.auth

data class SignupRequest(val email: String, val password: String, val name: String)
data class LoginRequest(val email: String, val password: String)
data class AuthResponse(val token: String, val name: String, val verified: Boolean)
data class UserProfileResponse(val id: Long, val email: String, val name: String, val verified: Boolean)
data class UpdateProfileRequest(val name: String)
data class UpdateProfileResponse(val token: String, val profile: UserProfileResponse)
data class ChangePasswordRequest(val currentPassword: String, val newPassword: String)
data class ChangePasswordResponse(val changed: Boolean, val token: String?)
data class ChangeEmailRequest(val currentPassword: String, val newEmail: String)
data class ChangeEmailResponse(val email: String, val name: String, val token: String)
data class DeleteAccountRequest(val currentPassword: String, val confirmText: String)
data class DeleteAccountResponse(val deleted: Boolean)

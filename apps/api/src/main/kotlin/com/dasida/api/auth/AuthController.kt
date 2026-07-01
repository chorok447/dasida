package com.dasida.api.auth

import com.dasida.api.security.AuthUser
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

/** HTTP adapter. 인증 사용자 추출 후 Service 위임과 status code 반환만 담당한다. */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth", description = "인증 및 계정 API")
class AuthController(private val authService: AuthService) {

    @Operation(summary = "회원가입")
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    fun signup(@RequestBody req: SignupRequest): AuthResponse = authService.signup(req)

    @Operation(summary = "로그인")
    @PostMapping("/login")
    fun login(@RequestBody req: LoginRequest): AuthResponse = authService.login(req)

    @Operation(summary = "내 정보 조회")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/me")
    fun me(@AuthenticationPrincipal principal: AuthUser?): UserProfileResponse =
        authService.getMe(requireUserId(principal))

    @Operation(summary = "프로필 수정")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/me")
    fun updateProfile(
        @AuthenticationPrincipal principal: AuthUser?,
        @RequestBody req: UpdateProfileRequest,
    ): UpdateProfileResponse = authService.updateProfile(requireUserId(principal), req)

    @Operation(summary = "비밀번호 변경")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/password")
    fun changePassword(
        @AuthenticationPrincipal principal: AuthUser?,
        @RequestBody req: ChangePasswordRequest,
    ): ChangePasswordResponse = authService.changePassword(requireUserId(principal), req)

    @Operation(summary = "이메일 변경")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/email")
    fun changeEmail(
        @AuthenticationPrincipal principal: AuthUser?,
        @RequestBody req: ChangeEmailRequest,
    ): ChangeEmailResponse = authService.changeEmail(requireUserId(principal), req)

    @Operation(summary = "계정 탈퇴")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/me")
    fun deleteAccount(
        @AuthenticationPrincipal principal: AuthUser?,
        @RequestBody req: DeleteAccountRequest,
    ): DeleteAccountResponse = authService.deleteAccount(requireUserId(principal), req)

    private fun requireUserId(principal: AuthUser?): Long =
        principal?.id ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "not authenticated")
}

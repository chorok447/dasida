package com.dasida.api.auth

import com.dasida.api.security.AuthUser
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
class AuthController(private val authService: AuthService) {

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    fun signup(@RequestBody req: SignupRequest): AuthResponse = authService.signup(req)

    @PostMapping("/login")
    fun login(@RequestBody req: LoginRequest): AuthResponse = authService.login(req)

    @GetMapping("/me")
    fun me(@AuthenticationPrincipal principal: AuthUser?): UserProfileResponse =
        authService.getMe(requireUserId(principal))

    @PutMapping("/me")
    fun updateProfile(
        @AuthenticationPrincipal principal: AuthUser?,
        @RequestBody req: UpdateProfileRequest,
    ): UpdateProfileResponse = authService.updateProfile(requireUserId(principal), req)

    @PutMapping("/password")
    fun changePassword(
        @AuthenticationPrincipal principal: AuthUser?,
        @RequestBody req: ChangePasswordRequest,
    ): ChangePasswordResponse = authService.changePassword(requireUserId(principal), req)

    @PutMapping("/email")
    fun changeEmail(
        @AuthenticationPrincipal principal: AuthUser?,
        @RequestBody req: ChangeEmailRequest,
    ): ChangeEmailResponse = authService.changeEmail(requireUserId(principal), req)

    @DeleteMapping("/me")
    fun deleteAccount(
        @AuthenticationPrincipal principal: AuthUser?,
        @RequestBody req: DeleteAccountRequest,
    ): DeleteAccountResponse = authService.deleteAccount(requireUserId(principal), req)

    private fun requireUserId(principal: AuthUser?): Long =
        principal?.id ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "not authenticated")
}

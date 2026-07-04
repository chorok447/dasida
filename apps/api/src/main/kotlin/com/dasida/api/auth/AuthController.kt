package com.dasida.api.auth

import com.dasida.api.security.AuthCookies
import com.dasida.api.security.AuthUser
import com.dasida.api.security.authCookieToken
import io.swagger.v3.oas.annotations.Operation
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

/** HTTP adapter. 인증 사용자 추출 후 Service 위임과 status code 반환만 담당한다. */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth", description = "인증 및 계정 API")
class AuthController(
    private val authService: AuthService,
    private val authCookies: AuthCookies,
) {

    @Operation(summary = "회원가입")
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    fun signup(@RequestBody req: SignupRequest, res: HttpServletResponse): AuthResponse =
        authService.signup(req).also { res.setAuthCookie(it.token) }

    @Operation(summary = "로그인")
    @PostMapping("/login")
    fun login(@RequestBody req: LoginRequest, res: HttpServletResponse): AuthResponse =
        authService.login(req).also { res.setAuthCookie(it.token) }

    @Operation(summary = "로그아웃")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/logout")
    fun logout(
        @AuthenticationPrincipal principal: AuthUser?,
        @RequestHeader("Authorization", required = false) authHeader: String?,
        req: HttpServletRequest,
        res: HttpServletResponse,
    ): LogoutResponse {
        // principal 이 있으면 필터가 검증한 토큰(Bearer 헤더 또는 인증 쿠키)이 존재한다. 미인증이면 401.
        requireUserId(principal)
        val token = authHeader?.removePrefix("Bearer ")?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: req.authCookieToken()
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "not authenticated")
        return authService.logout(token).also {
            res.addHeader(HttpHeaders.SET_COOKIE, authCookies.expire().toString())
        }
    }

    @Operation(summary = "내 정보 조회")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/me")
    fun me(@AuthenticationPrincipal principal: AuthUser?): UserProfileResponse =
        authService.getMe(requireUserId(principal))

    // 프로필/비밀번호/이메일 변경은 claim 이 갱신된 토큰을 재발급한다 → 인증 쿠키도 함께 교체한다.

    @Operation(summary = "프로필 수정")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/me")
    fun updateProfile(
        @AuthenticationPrincipal principal: AuthUser?,
        @RequestBody req: UpdateProfileRequest,
        res: HttpServletResponse,
    ): UpdateProfileResponse =
        authService.updateProfile(requireUserId(principal), req).also { res.setAuthCookie(it.token) }

    @Operation(summary = "비밀번호 변경")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/password")
    fun changePassword(
        @AuthenticationPrincipal principal: AuthUser?,
        @RequestBody req: ChangePasswordRequest,
        res: HttpServletResponse,
    ): ChangePasswordResponse =
        authService.changePassword(requireUserId(principal), req).also { result ->
            result.token?.let { res.setAuthCookie(it) }
        }

    @Operation(summary = "이메일 변경")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/email")
    fun changeEmail(
        @AuthenticationPrincipal principal: AuthUser?,
        @RequestBody req: ChangeEmailRequest,
        res: HttpServletResponse,
    ): ChangeEmailResponse =
        authService.changeEmail(requireUserId(principal), req).also { res.setAuthCookie(it.token) }

    @Operation(summary = "계정 탈퇴")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/me")
    fun deleteAccount(
        @AuthenticationPrincipal principal: AuthUser?,
        @RequestBody req: DeleteAccountRequest,
        res: HttpServletResponse,
    ): DeleteAccountResponse =
        authService.deleteAccount(requireUserId(principal), req).also {
            res.addHeader(HttpHeaders.SET_COOKIE, authCookies.expire().toString())
        }

    private fun requireUserId(principal: AuthUser?): Long =
        principal?.id ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "not authenticated")

    private fun HttpServletResponse.setAuthCookie(token: String) {
        addHeader(HttpHeaders.SET_COOKIE, authCookies.issue(token).toString())
    }
}

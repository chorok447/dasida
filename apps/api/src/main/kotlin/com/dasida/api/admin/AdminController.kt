package com.dasida.api.admin

import com.dasida.api.security.AuthUser
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 관리자 API. /api/admin 이하 전체가 SecurityConfig 에서 ROLE_ADMIN 으로 보호된다
 * (JwtAuthFilter 가 매 요청 DB role 을 읽어 권한을 부여하므로 권한 회수가 즉시 반영).
 */
@RestController
@RequestMapping("/api/admin")
@Tag(name = "Admin", description = "관리자 API (ROLE_ADMIN 전용)")
@SecurityRequirement(name = "bearerAuth")
class AdminController(
    private val service: AdminReportService,
    private val content: AdminContentService,
    private val userService: AdminUserService,
    private val actionLogs: AdminActionLogService,
) {

    @Operation(summary = "대시보드 요약 (사용자/게시글/캠페인/신고 수)")
    @GetMapping("/summary")
    fun summary(): AdminSummaryResponse = service.getSummary()

    @Operation(summary = "신고 목록 조회 (상태·대상종류 필터, 대상 미리보기 포함)")
    @GetMapping("/reports")
    fun reports(
        @RequestParam(required = false) status: String?,
        @RequestParam(required = false) targetType: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): AdminReportsPageResponse = service.getReports(status, targetType, page, size)

    @Operation(summary = "신고 처리 (제재 확정 또는 기각, 신고자에게 결과 알림, 옵션으로 콘텐츠 숨김)")
    @PatchMapping("/reports/{id}")
    fun resolve(
        @PathVariable id: String,
        @RequestBody request: ResolveReportRequest,
        @AuthenticationPrincipal admin: AuthUser,
    ): AdminReportResponse = service.resolveReport(admin.id, id, request)

    @Operation(summary = "콘텐츠 숨김/복구 (soft hide, 작성자에게 알림)")
    @PatchMapping("/content/{targetType}/{targetId}")
    fun setContentVisibility(
        @PathVariable targetType: String,
        @PathVariable targetId: String,
        @RequestBody request: SetContentVisibilityRequest,
        @AuthenticationPrincipal admin: AuthUser,
    ): ContentVisibilityResponse = content.setVisibility(admin.id, targetType, targetId, request)

    @Operation(summary = "회원 목록 조회 (이메일/이름 검색, 정지 중 필터, 최신 가입 순)")
    @GetMapping("/users")
    fun adminUsers(
        @RequestParam(required = false) q: String?,
        @RequestParam(defaultValue = "false") suspended: Boolean,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): AdminUsersPageResponse = userService.getUsers(q, suspended, page, size)

    @Operation(summary = "회원 정지/해제 (로그인·기존 토큰·refresh 즉시 차단)")
    @PatchMapping("/users/{id}/suspension")
    fun setUserSuspension(
        @PathVariable id: Long,
        @RequestBody request: SetUserSuspensionRequest,
        @AuthenticationPrincipal admin: AuthUser,
    ): AdminUserResponse = userService.setSuspension(admin.id, id, request)

    @Operation(summary = "감사 로그 조회 (관리자 조치 이력, 최신순, 조치 종류 필터)")
    @GetMapping("/logs")
    fun adminLogs(
        @RequestParam(required = false) action: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): AdminActionLogsPageResponse = actionLogs.getLogs(action, page, size)
}

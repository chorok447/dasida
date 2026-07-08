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
class AdminController(private val service: AdminReportService) {

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

    @Operation(summary = "신고 처리 (제재 확정 또는 기각, 신고자에게 결과 알림)")
    @PatchMapping("/reports/{id}")
    fun resolve(
        @PathVariable id: String,
        @RequestBody request: ResolveReportRequest,
        @AuthenticationPrincipal admin: AuthUser,
    ): AdminReportResponse = service.resolveReport(admin.id, id, request)
}

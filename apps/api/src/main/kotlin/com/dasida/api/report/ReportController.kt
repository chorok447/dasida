package com.dasida.api.report

import com.dasida.api.security.AuthUser
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/** HTTP adapter. 인증 사용자 추출 후 Service 위임과 status code 반환만 담당한다. */
@RestController
@RequestMapping("/api/reports")
@Tag(name = "Reports", description = "콘텐츠 신고 API")
@SecurityRequirement(name = "bearerAuth")
class ReportController(private val service: ReportService) {

    @Operation(summary = "콘텐츠 신고")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @RequestBody request: CreateReportRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): ReportResponse = service.createReport(user.id, request)

    @Operation(summary = "내 신고 목록 조회")
    @GetMapping("/mine")
    fun mine(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): ReportsPageResponse = service.getMyReports(user.id, page, size)
}

package com.dasida.api.report

import io.swagger.v3.oas.annotations.media.Schema

@Schema(description = "콘텐츠 신고 요청")
data class CreateReportRequest(
    @field:Schema(description = "신고 대상 종류", example = "POST", allowableValues = ["POST", "POST_COMMENT", "CAMPAIGN", "CAMPAIGN_COMMENT", "CAMPAIGN_PROOF"])
    val targetType: String,
    @field:Schema(description = "신고 대상 id")
    val targetId: String,
    @field:Schema(description = "신고 사유")
    val reason: String,
    @field:Schema(description = "상세 사유(선택, 최대 500자)")
    val detail: String? = null,
)

@Schema(description = "신고 응답")
data class ReportResponse(
    val id: String,
    val targetType: String,
    val targetId: String,
    val reason: String,
    val detail: String?,
    val time: String,
    @field:Schema(description = "처리 상태", allowableValues = ["PENDING", "RESOLVED", "DISMISSED"])
    val status: String = "PENDING",
)

data class ReportsPageResponse(
    val content: List<ReportResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

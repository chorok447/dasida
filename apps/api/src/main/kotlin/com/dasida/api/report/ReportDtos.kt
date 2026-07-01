package com.dasida.api.report

data class CreateReportRequest(
    val targetType: String,
    val targetId: String,
    val reason: String,
    val detail: String? = null,
)

data class ReportResponse(
    val id: String,
    val targetType: String,
    val targetId: String,
    val reason: String,
    val detail: String?,
    val time: String,
)

data class ReportsPageResponse(
    val content: List<ReportResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

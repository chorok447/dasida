package com.dasida.api.report

fun Report.toResponse() = ReportResponse(
    id = id,
    targetType = targetType,
    targetId = targetId,
    reason = reason,
    detail = detail,
    time = time,
)

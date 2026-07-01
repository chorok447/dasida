package com.dasida.api.report

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface ReportRepository : JpaRepository<Report, String> {
    fun existsByReporterUserIdAndTargetTypeAndTargetId(
        reporterUserId: Long,
        targetType: String,
        targetId: String,
    ): Boolean

    fun findByReporterUserId(reporterUserId: Long, pageable: Pageable): Page<Report>
}

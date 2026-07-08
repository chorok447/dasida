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

    // 관리자 신고 큐: 상태/대상종류 필터 조합(NotificationService 의 조건 분기 패턴).
    fun findByStatus(status: String, pageable: Pageable): Page<Report>

    fun findByTargetType(targetType: String, pageable: Pageable): Page<Report>

    fun findByStatusAndTargetType(status: String, targetType: String, pageable: Pageable): Page<Report>

    fun countByStatus(status: String): Long

    fun countByTargetTypeAndTargetId(targetType: String, targetId: String): Long
}

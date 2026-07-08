package com.dasida.api.report

import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.Instant

@Entity
@Table(
    name = "reports",
    uniqueConstraints = [
        UniqueConstraint(
            name = "uk_reports_reporter_target",
            columnNames = ["reporter_user_id", "target_type", "target_id"],
        ),
    ],
    indexes = [
        Index(name = "idx_reports_reporter_seq", columnList = "reporter_user_id, seq"),
        Index(name = "idx_reports_target", columnList = "target_type, target_id"),
        Index(name = "idx_reports_seq", columnList = "seq"),
        Index(name = "idx_reports_status_seq", columnList = "status, seq"),
    ],
)
class Report(
    @Id val id: String,
    @Column(name = "reporter_user_id", nullable = false) @JsonIgnore val reporterUserId: Long,
    @Column(name = "target_type", nullable = false) val targetType: String,
    @Column(name = "target_id", nullable = false) val targetId: String,
    @Column(nullable = false) val reason: String,
    @Column(columnDefinition = "TEXT") val detail: String?,
    @Column(name = "time_label", nullable = false) val time: String,
    @Column(nullable = false) val seq: Long,
    // 관리자 처리 상태. enum name 저장(ReportStatus).
    @Column(nullable = false, length = 20) var status: String = ReportStatus.PENDING.name,
    @Column(name = "resolved_by_user_id") @JsonIgnore var resolvedByUserId: Long? = null,
    @Column(name = "resolved_at") var resolvedAt: Instant? = null,
    @Column(name = "resolution_note", length = 500) var resolutionNote: String? = null,
)

enum class ReportTargetType {
    POST,
    POST_COMMENT,
    CAMPAIGN,
    CAMPAIGN_COMMENT,
}

enum class ReportReason {
    SPAM,
    ABUSE,
    INAPPROPRIATE,
    SCAM,
    OTHER,
}

enum class ReportStatus {
    PENDING,
    RESOLVED,
    DISMISSED,
}

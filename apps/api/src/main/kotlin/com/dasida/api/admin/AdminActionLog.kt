package com.dasida.api.admin

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant

/**
 * 관리자 감사 로그. 조치(신고 처리/콘텐츠 숨김·복구/회원 정지·해제)와 같은 트랜잭션에서 기록되어
 * 조치가 롤백되면 로그도 남지 않는다. append-only — 수정/삭제 API 는 만들지 않는다.
 */
@Entity
@Table(
    name = "admin_action_logs",
    indexes = [Index(name = "idx_admin_action_logs_action_id", columnList = "action,id")],
)
class AdminActionLog(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long? = null,
    @Column(name = "admin_user_id", nullable = false) val adminUserId: Long,
    // Report.status 와 같은 패턴: enum name 을 String 컬럼에 저장(AdminActionType 참조).
    @Column(nullable = false, length = 30) val action: String,
    // REPORT/USER 또는 ReportTargetType(POST, POST_COMMENT, CAMPAIGN, CAMPAIGN_COMMENT).
    @Column(name = "target_type", nullable = false, length = 30) val targetType: String,
    @Column(name = "target_id", nullable = false, length = 64) val targetId: String,
    @Column(length = 500) val detail: String? = null,
    @Column(name = "created_at", nullable = false) val createdAt: Instant,
)

enum class AdminActionType {
    REPORT_RESOLVED,
    REPORT_DISMISSED,
    CONTENT_HIDDEN,
    CONTENT_RESTORED,
    USER_SUSPENDED,
    USER_UNSUSPENDED,
    ROLE_CHANGED,
}

interface AdminActionLogRepository : JpaRepository<AdminActionLog, Long> {
    fun findByAction(action: String, pageable: Pageable): Page<AdminActionLog>
}

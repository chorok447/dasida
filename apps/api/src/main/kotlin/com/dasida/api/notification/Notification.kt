package com.dasida.api.notification

import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import java.time.Instant

/** 알림 타입. 이번 PR 범위. */
object NotificationType {
    const val POST_COMMENT_CREATED = "POST_COMMENT_CREATED"
    const val COMMENT_REPLY_CREATED = "COMMENT_REPLY_CREATED"
    const val CAMPAIGN_COMMENT_CREATED = "CAMPAIGN_COMMENT_CREATED"
    const val CAMPAIGN_JOINED = "CAMPAIGN_JOINED"
    const val CAMPAIGN_PROOF_CREATED = "CAMPAIGN_PROOF_CREATED"
    const val CAMPAIGN_PARTICIPATION_REMOVED = "CAMPAIGN_PARTICIPATION_REMOVED"
    const val USER_FOLLOWED = "USER_FOLLOWED"
    const val MESSAGE_RECEIVED = "MESSAGE_RECEIVED"
    const val POST_LIKED = "POST_LIKED"
    const val CAMPAIGN_STATUS_CHANGED = "CAMPAIGN_STATUS_CHANGED"
    const val REPORT_RESOLVED = "REPORT_RESOLVED"
    const val CONTENT_HIDDEN = "CONTENT_HIDDEN"
    const val CONTENT_RESTORED = "CONTENT_RESTORED"
}

/**
 * 사용자별 알림. userId 는 수신자이며 응답에 노출하지 않는다(@JsonIgnore).
 * 정렬은 seq DESC, id ASC. readAt == null 이면 unread.
 */
@Entity
@Table(
    name = "notifications",
    indexes = [
        Index(name = "idx_notifications_user_read_seq", columnList = "user_id, read_at, seq"),
        Index(name = "idx_notifications_user_seq", columnList = "user_id, seq"),
    ],
)
class Notification(
    @Id val id: String,
    @Column(name = "user_id", nullable = false) @JsonIgnore val userId: Long,
    @Column(nullable = false) val type: String,
    @Column(nullable = false) val title: String,
    @Column(nullable = false, columnDefinition = "TEXT") val body: String,
    @Column(nullable = false) val href: String,
    @Column(name = "read_at") var readAt: Instant?,
    @Column(name = "created_at", nullable = false) val createdAt: Instant,
    // 작성 시점 표시 스냅샷. 프론트는 createdAt 으로 상대시간을 만들고 이 값은 fallback.
    @Column(nullable = false) val time: String,
    @JsonIgnore val seq: Long,
)

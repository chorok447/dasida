package com.dasida.api.auth

import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "users")
class User(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long? = null,
    @Column(unique = true) var email: String,
    @JsonIgnore var passwordHash: String,
    var name: String,
    val verified: Boolean = false,
    @Column(name = "profile_image_url", length = 500) var profileImageUrl: String? = null,
    @Column(name = "notify_campaign_updates", nullable = false) var notifyCampaignUpdates: Boolean = true,
    @Column(name = "deleted_at") @JsonIgnore var deletedAt: Instant? = null,
    // Report.targetType 과 같은 패턴: enum name 을 String 컬럼에 저장(UserRole 참조).
    @Column(nullable = false, length = 20) var role: String = UserRole.USER.name,
    // 관리자 제재. null 또는 과거 = 정상, 미래 = 정지 중(로그인·기존 토큰 모두 차단).
    @Column(name = "suspended_until") @JsonIgnore var suspendedUntil: Instant? = null,
    @Column(name = "suspended_reason", length = 500) @JsonIgnore var suspendedReason: String? = null,
) {
    val isAdmin: Boolean
        @JsonIgnore get() = role == UserRole.ADMIN.name

    fun isSuspendedAt(now: Instant): Boolean = suspendedUntil?.isAfter(now) == true
}

enum class UserRole {
    USER,
    ADMIN,
}

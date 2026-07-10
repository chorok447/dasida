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
    // 인증 계정 배지(프로필·작성자 스냅샷에 노출). 이메일 인증이 아니라 운영자가 부여하는 신뢰 표식으로,
    // 현재는 시드 계정에만 true. 이메일 인증 플로우 도입 시 의미를 재정의할 것.
    val verified: Boolean = false,
    @Column(name = "profile_image_url", length = 500) var profileImageUrl: String? = null,
    @Column(name = "notify_campaign_updates", nullable = false) var notifyCampaignUpdates: Boolean = true,
    // DM(새 메시지) 알림 수신 여부. false 면 MESSAGE_RECEIVED 알림을 만들지 않는다(실시간 WS 배지는 유지).
    @Column(name = "notify_messages", nullable = false) var notifyMessages: Boolean = true,
    @Column(name = "deleted_at") @JsonIgnore var deletedAt: Instant? = null,
    // Report.targetType 과 같은 패턴: enum name 을 String 컬럼에 저장(UserRole 참조).
    @Column(nullable = false, length = 20) var role: String = UserRole.USER.name,
    // 관리자 제재. null 또는 과거 = 정상, 미래 = 정지 중(로그인·기존 토큰 모두 차단).
    @Column(name = "suspended_until") @JsonIgnore var suspendedUntil: Instant? = null,
    @Column(name = "suspended_reason", length = 500) @JsonIgnore var suspendedReason: String? = null,
    // 가입 시각. V12 이전 가입자는 null(가입 시점을 알 수 없음).
    @Column(name = "created_at") val createdAt: Instant? = null,
    // 자격증명(비밀번호·이메일) 마지막 변경 시각. 이전에 발급된 토큰은 refresh·인증 필터에서 거절된다.
    @Column(name = "credentials_changed_at") @JsonIgnore var credentialsChangedAt: Instant? = null,
) {
    val isAdmin: Boolean
        @JsonIgnore get() = role == UserRole.ADMIN.name

    fun isSuspendedAt(now: Instant): Boolean = suspendedUntil?.isAfter(now) == true

    /**
     * 자격증명(비밀번호·이메일) 변경 이전에 발급된 토큰인지. 변경 이후 발급 토큰만 유효 —
     * 탈취된 refresh 가 rotation 으로 영구 연장되는 것을 비밀번호 변경으로 끊는다.
     * JWT iat 은 초 단위 절삭이므로 변경 시각도 초로 절삭해 같은 초에 재발급된 토큰은 통과시킨다.
     */
    fun isTokenIssuedBeforeCredentialsChange(issuedAt: Instant?): Boolean {
        val changed = credentialsChangedAt ?: return false
        if (issuedAt == null) return true
        return issuedAt.isBefore(changed.truncatedTo(java.time.temporal.ChronoUnit.SECONDS))
    }
}

enum class UserRole {
    USER,
    ADMIN,
}

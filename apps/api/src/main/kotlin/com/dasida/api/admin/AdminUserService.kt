package com.dasida.api.admin

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.common.checkPageParams
import com.dasida.api.post.PostRepository
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Clock
import java.time.Instant
import java.time.format.DateTimeParseException

/**
 * 관리자 회원 관리 서비스. 회원 목록/검색과 정지(제재)·해제를 담당한다.
 * 정지는 JwtAuthFilter(기존 토큰)·login·refresh 세 경로에서 함께 차단된다.
 */
@Service
class AdminUserService(
    private val users: UserRepository,
    private val posts: PostRepository,
    private val campaigns: CampaignRepository,
    private val actionLogs: AdminActionLogService,
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun getUsers(q: String?, suspendedOnly: Boolean, page: Int, size: Int): AdminUsersPageResponse {
        checkPageParams(page, size, MAX_PAGE_SIZE)
        val query = q?.trim()?.takeIf { it.isNotEmpty() }
        if (query != null && query.length > MAX_QUERY_LENGTH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "q must not exceed $MAX_QUERY_LENGTH characters")
        }
        val now = Instant.now(clock)
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"))
        val result = users.searchForAdmin(query?.lowercase(), suspendedOnly, now, pageable)
        return AdminUsersPageResponse(
            content = result.content.map { it.toAdminResponse(now) },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    @Transactional
    fun setSuspension(adminUserId: Long, userId: Long, request: SetUserSuspensionRequest): AdminUserResponse {
        val user = users.findById(userId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "user not found")
        }
        if (user.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "user not found")
        }
        // 관리자 계정(본인 포함)은 이 API 로 정지할 수 없다. 실수로 전원이 잠기는 사고 방지.
        if (user.isAdmin) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "cannot suspend an admin account")
        }
        val reason = request.reason?.trim()?.ifEmpty { null }
        if (reason != null && reason.length > MAX_REASON_LENGTH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "reason must not exceed $MAX_REASON_LENGTH characters")
        }

        val now = Instant.now(clock)
        if (request.suspendedUntil == null) {
            // 실제로 정지 중이었던 경우에만 기록한다(이미 정상인 계정의 해제 재요청은 무음).
            val wasSuspended = user.isSuspendedAt(now)
            user.suspendedUntil = null
            user.suspendedReason = null
            if (wasSuspended) {
                actionLogs.record(adminUserId, AdminActionType.USER_UNSUSPENDED, TARGET_TYPE_USER, userId.toString())
            }
        } else {
            val until = try {
                Instant.parse(request.suspendedUntil)
            } catch (_: DateTimeParseException) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "suspendedUntil must be an ISO-8601 instant")
            }
            if (!until.isAfter(now)) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "suspendedUntil must be in the future")
            }
            user.suspendedUntil = until
            user.suspendedReason = reason
            actionLogs.record(
                adminUserId,
                AdminActionType.USER_SUSPENDED,
                TARGET_TYPE_USER,
                userId.toString(),
                detail = suspensionDetail(until, now, reason),
            )
        }
        return user.toAdminResponse(now)
    }

    /** 감사 로그용 정지 요약. AuthService 의 로그인 안내와 같은 기준(50년 초과 = 영구)으로 표기한다. */
    private fun suspensionDetail(until: Instant, now: Instant, reason: String?): String {
        val period = if (until.isAfter(now.plus(java.time.Duration.ofDays(365L * 50)))) {
            "영구 정지"
        } else {
            "${java.time.LocalDate.ofInstant(until, java.time.ZoneId.of("Asia/Seoul"))} 까지"
        }
        return if (reason != null) "$period · $reason" else period
    }

    private fun User.toAdminResponse(now: Instant): AdminUserResponse = AdminUserResponse(
        id = requireNotNull(id),
        email = email,
        name = name,
        verified = verified,
        role = role,
        deleted = deletedAt != null,
        suspended = isSuspendedAt(now),
        suspendedUntil = suspendedUntil?.takeIf { it.isAfter(now) }?.toString(),
        suspendedReason = suspendedReason?.takeIf { isSuspendedAt(now) },
        postCount = posts.countByAuthorUserId(requireNotNull(id)),
        campaignCount = campaigns.countByAuthorUserId(requireNotNull(id)),
    )

    private companion object {
        const val TARGET_TYPE_USER = "USER"
        const val MAX_PAGE_SIZE = 100
        const val MAX_QUERY_LENGTH = 100
        const val MAX_REASON_LENGTH = 500
    }
}

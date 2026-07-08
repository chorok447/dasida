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
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun getUsers(q: String?, page: Int, size: Int): AdminUsersPageResponse {
        checkPageParams(page, size, MAX_PAGE_SIZE)
        val query = q?.trim()?.takeIf { it.isNotEmpty() }
        if (query != null && query.length > MAX_QUERY_LENGTH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "q must not exceed $MAX_QUERY_LENGTH characters")
        }
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"))
        val result = if (query == null) {
            users.findAll(pageable)
        } else {
            users.findByEmailContainingIgnoreCaseOrNameContainingIgnoreCase(query, query, pageable)
        }
        val now = Instant.now(clock)
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
            user.suspendedUntil = null
            user.suspendedReason = null
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
        }
        return user.toAdminResponse(now)
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
        const val MAX_PAGE_SIZE = 100
        const val MAX_QUERY_LENGTH = 100
        const val MAX_REASON_LENGTH = 500
    }
}

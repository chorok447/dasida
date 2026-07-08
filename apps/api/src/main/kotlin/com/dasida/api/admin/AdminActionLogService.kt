package com.dasida.api.admin

import com.dasida.api.auth.UserRepository
import com.dasida.api.common.checkPageParams
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Clock
import java.time.Instant

/**
 * 관리자 감사 로그 서비스. 기록은 각 조치 서비스가 자기 트랜잭션 안에서 호출하고,
 * 조회는 최신순 페이지네이션(조치 종류 필터)으로 제공한다.
 */
@Service
class AdminActionLogService(
    private val logs: AdminActionLogRepository,
    private val users: UserRepository,
    private val clock: Clock,
) {
    /** 조치와 같은 트랜잭션에서 호출된다(조치가 롤백되면 로그도 함께 롤백). */
    fun record(adminUserId: Long, action: AdminActionType, targetType: String, targetId: String, detail: String? = null) {
        logs.save(
            AdminActionLog(
                adminUserId = adminUserId,
                action = action.name,
                targetType = targetType,
                targetId = targetId,
                detail = detail?.take(MAX_DETAIL_LENGTH),
                createdAt = Instant.now(clock),
            ),
        )
    }

    @Transactional(readOnly = true)
    fun getLogs(action: String?, page: Int, size: Int): AdminActionLogsPageResponse {
        checkPageParams(page, size, MAX_PAGE_SIZE)
        val actionFilter = action?.takeIf { it.isNotBlank() }?.let {
            try {
                AdminActionType.valueOf(it.trim()).name
            } catch (_: IllegalArgumentException) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid action type")
            }
        }
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"))
        val result = if (actionFilter == null) logs.findAll(pageable) else logs.findByAction(actionFilter, pageable)
        // 관리자 이름은 페이지 단위로 일괄 조회한다(행마다 findById 하지 않도록).
        val admins = users.findAllById(result.content.map { it.adminUserId }.toSet()).associateBy { it.id }
        return AdminActionLogsPageResponse(
            content = result.content.map { log ->
                val admin = admins[log.adminUserId]
                AdminActionLogResponse(
                    id = requireNotNull(log.id),
                    action = log.action,
                    targetType = log.targetType,
                    targetId = log.targetId,
                    detail = log.detail,
                    createdAt = log.createdAt.toString(),
                    admin = AdminReportUserResponse(
                        id = log.adminUserId,
                        name = admin?.name ?: "알 수 없음",
                        // 탈퇴 계정 이메일은 익명화된 placeholder 라 노출 의미가 없다.
                        email = admin?.takeIf { it.deletedAt == null }?.email,
                    ),
                )
            },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    private companion object {
        const val MAX_PAGE_SIZE = 100
        const val MAX_DETAIL_LENGTH = 500
    }
}

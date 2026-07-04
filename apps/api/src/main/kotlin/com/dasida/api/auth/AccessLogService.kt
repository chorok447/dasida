package com.dasida.api.auth

import com.dasida.api.common.ClientRequestInfo
import com.dasida.api.common.checkPageParams
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.time.temporal.ChronoUnit

@Service
class AccessLogService(
    private val repo: UserAccessLogRepository,
    private val clock: Clock,
) {
    @Transactional
    fun record(userId: Long, info: ClientRequestInfo) {
        val now = Instant.now(clock)
        repo.save(
            UserAccessLog(
                userId = userId,
                ipAddress = normalizeIp(info.ipAddress),
                os = info.os.take(32),
                accessedAt = now,
            ),
        )
        repo.deleteByAccessedAtBefore(now.minus(RETENTION_DAYS, ChronoUnit.DAYS))
    }

    @Transactional(readOnly = true)
    fun listForUser(userId: Long, page: Int, size: Int): AccessLogPageResponse {
        checkPageParams(page, size, MAX_PAGE_SIZE)
        val since = Instant.now(clock).minus(RETENTION_DAYS, ChronoUnit.DAYS)
        val result = repo.findByUserIdAndAccessedAtAfterOrderByAccessedAtDesc(
            userId,
            since,
            PageRequest.of(page, size),
        )
        return AccessLogPageResponse(
            content = result.content.map { it.toResponse() },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    @Transactional
    fun deleteForUser(userId: Long) {
        repo.deleteByUserId(userId)
    }

    private fun UserAccessLog.toResponse() = AccessLogResponse(
        id = requireNotNull(id),
        ipAddress = ipAddress,
        os = os,
        accessedAt = accessedAt.toString(),
    )

    private fun normalizeIp(ip: String): String = ip.take(45).ifBlank { "unknown" }

    private companion object {
        const val RETENTION_DAYS = 365L
        const val MAX_PAGE_SIZE = 50
    }
}

package com.dasida.api.auth

import com.dasida.api.common.ClientRequestInfo
import com.dasida.api.common.checkPageParams
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.scheduling.annotation.Scheduled
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
        // 보존기간 정리는 여기서 하지 않는다: 로그인/가입마다 bulk delete 를 실행하면
        // 동시 요청 간 MySQL 데드락(1213)으로 인증 자체가 500 이 난다 → 일일 배치(purgeExpired)로 분리.
        // 조회(listForUser)는 accessedAt 필터를 쓰므로 만료 로그가 지연 삭제돼도 노출되지 않는다.
        repo.save(
            UserAccessLog(
                userId = userId,
                ipAddress = normalizeIp(info.ipAddress),
                os = info.os.take(32),
                accessedAt = Instant.now(clock),
            ),
        )
    }

    /** 보존기간(365일) 지난 접속 기록의 일일 정리 배치. 실패해도 다음 주기에 다시 시도되므로 로그만 남긴다. */
    @Scheduled(cron = "0 30 4 * * *")
    @Transactional
    fun purgeExpired() {
        try {
            val removed = repo.deleteByAccessedAtBefore(Instant.now(clock).minus(RETENTION_DAYS, ChronoUnit.DAYS))
            if (removed > 0) log.info("purged {} expired access logs", removed)
        } catch (ex: Exception) {
            log.warn("access log purge failed, will retry next cycle", ex)
        }
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
        val log = LoggerFactory.getLogger(AccessLogService::class.java)
        const val RETENTION_DAYS = 365L
        const val MAX_PAGE_SIZE = 50
    }
}

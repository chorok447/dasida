package com.dasida.api.auth

import com.dasida.api.common.ClientRequestInfo
import com.dasida.api.common.checkPageParams
import com.dasida.api.common.geo.GeoIpService
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.time.Clock
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.concurrent.Executors

@Service
class AccessLogService(
    private val repo: UserAccessLogRepository,
    private val clock: Clock,
    private val geoIp: GeoIpService,
) {
    // 위치 보강 전용 소규모 데몬 풀. 외부 조회가 느려도 로그인 응답에는 영향이 없다.
    private val geoExecutor = Executors.newFixedThreadPool(2) { runnable ->
        Thread(runnable, "access-log-geo").apply { isDaemon = true }
    }

    @Transactional
    fun record(userId: Long, info: ClientRequestInfo) {
        // 보존기간 정리는 여기서 하지 않는다: 로그인/가입마다 bulk delete 를 실행하면
        // 동시 요청 간 MySQL 데드락(1213)으로 인증 자체가 500 이 난다 → 일일 배치(purgeExpired)로 분리.
        // 조회(listForUser)는 accessedAt 필터를 쓰므로 만료 로그가 지연 삭제돼도 노출되지 않는다.
        val ip = normalizeIp(info.ipAddress)
        val saved = repo.save(
            UserAccessLog(
                userId = userId,
                ipAddress = ip,
                os = info.os.take(32),
                browser = info.browser.take(32),
                accessedAt = Instant.now(clock),
            ),
        )
        scheduleGeoEnrichment(requireNotNull(saved.id), ip)
    }

    /**
     * IP 기반 위치(국가·지역)를 커밋 후 비동기로 채운다. 외부 조회라 로그인 경로에서 동기로 기다리지
     * 않고, 실패하면 위치는 비워 둔다(표시용 베스트에포트 정보).
     */
    private fun scheduleGeoEnrichment(logId: Long, ip: String) {
        val task = Runnable {
            try {
                val location = geoIp.lookup(ip) ?: return@Runnable
                repo.updateLocation(logId, location.country, location.region)
            } catch (ex: Exception) {
                log.debug("access log geo enrichment failed (id={})", logId, ex)
            }
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            // 트랜잭션 커밋 전에 실행되면 row 가 보이지 않아 update 가 유실된다 → 커밋 후로 미룬다.
            TransactionSynchronizationManager.registerSynchronization(object : TransactionSynchronization {
                override fun afterCommit() {
                    geoExecutor.execute(task)
                }
            })
        } else {
            geoExecutor.execute(task)
        }
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
        browser = browser,
        country = country,
        region = region,
        accessedAt = accessedAt.toString(),
    )

    private fun normalizeIp(ip: String): String = ip.take(45).ifBlank { "unknown" }

    private companion object {
        val log = LoggerFactory.getLogger(AccessLogService::class.java)
        const val RETENTION_DAYS = 365L
        const val MAX_PAGE_SIZE = 50
    }
}

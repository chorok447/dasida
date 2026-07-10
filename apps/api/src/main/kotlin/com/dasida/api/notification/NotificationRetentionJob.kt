package com.dasida.api.notification

import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * 알림 보존기간 정리 배치. 사용자가 "읽은 알림 삭제"를 직접 누르지 않으면 알림이 무한히 쌓여
 * 사용자별 목록·미읽음 집계가 느려지는 것을 막는다(접속기록 정리 배치와 같은 패턴).
 *
 * - 읽은 알림: 읽은 지 30일 경과 시 삭제(딥링크 재방문 여지를 남긴 보수적 기간)
 * - 미읽음 알림: 생성 180일 경과 시 삭제(방치 계정의 무한 적재 방지)
 */
@Component
class NotificationRetentionJob(
    private val repo: NotificationRepository,
    private val clock: Clock,
) {
    // 접속기록 배치(04:30)와 겹치지 않는 새벽 시간대.
    @Scheduled(cron = "0 50 4 * * *")
    @Transactional
    fun purgeExpired() {
        try {
            val now = Instant.now(clock)
            val removedRead = repo.deleteReadBefore(now.minus(READ_RETENTION_DAYS, ChronoUnit.DAYS))
            val removedUnread = repo.deleteUnreadCreatedBefore(now.minus(UNREAD_RETENTION_DAYS, ChronoUnit.DAYS))
            if (removedRead + removedUnread > 0) {
                log.info("purged expired notifications (read={}, unread={})", removedRead, removedUnread)
            }
        } catch (ex: Exception) {
            // 실패해도 다음 주기에 다시 시도되므로 로그만 남긴다.
            log.warn("notification purge failed, will retry next cycle", ex)
        }
    }

    private companion object {
        private val log = LoggerFactory.getLogger(NotificationRetentionJob::class.java)
        const val READ_RETENTION_DAYS = 30L
        const val UNREAD_RETENTION_DAYS = 180L
    }
}

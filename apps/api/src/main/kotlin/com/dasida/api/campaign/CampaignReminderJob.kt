package com.dasida.api.campaign

import com.dasida.api.auth.UserRepository
import com.dasida.api.notification.NotificationService
import com.dasida.api.notification.NotificationType
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.time.LocalDate

/**
 * 캠페인 모집 마감 임박(D-1) 알림 배치. 저장(북마크)만 하고 아직 참여하지 않은 사용자는
 * 상태 전환 알림(참여자 대상)을 받지 못해 마감을 놓치기 쉽다 — 그 공백을 메운다.
 *
 * - 대상: open + 미숨김·미삭제 + recruitEnd 가 내일 + 미발송(recruitEndReminderSentAt null)
 * - 수신자: 캠페인을 저장한 사용자 중 아직 참여하지 않은 사람(참여자는 이미 상태 알림 대상).
 *   notifyCampaignUpdates 설정을 존중하고, 개설자 본인은 notify() 의 self-skip 으로 제외된다.
 * - 멱등성: 발송 후 recruitEndReminderSentAt 마킹 — 재기동/중복 실행에도 캠페인당 1회.
 */
@Component
class CampaignReminderJob(
    private val campaigns: CampaignRepository,
    private val bookmarks: CampaignBookmarkRepository,
    private val participants: CampaignParticipantRepository,
    private val users: UserRepository,
    private val notifications: NotificationService,
    private val clock: Clock,
) {
    // 접속기록 정리 배치(04:30)와 같은 패턴의 새벽 대신, 사용자가 볼 수 있는 아침 시간대로.
    @Scheduled(cron = "0 40 8 * * *")
    fun sendRecruitEndingReminders() {
        val sent = remindRecruitEndingTomorrow()
        if (sent > 0) log.info("campaign recruit-ending reminders sent: {}", sent)
    }

    /** 테스트에서 직접 호출할 수 있도록 분리. 발송한 알림 수를 반환한다. */
    @Transactional
    fun remindRecruitEndingTomorrow(): Int {
        val tomorrow = LocalDate.now(clock).plusDays(1).toString()
        val targets = campaigns.findByStatusAndRecruitEndAndHiddenAtIsNullAndDeletedAtIsNullAndRecruitEndReminderSentAtIsNull(
            "open",
            tomorrow,
        )
        var sent = 0
        val now = Instant.now(clock)
        targets.forEach { campaign ->
            val joinedUserIds = participants.findByCampaignId(campaign.id).map { it.userId }.toSet()
            bookmarks.findByCampaignId(campaign.id)
                .asSequence()
                .filter { it.userId !in joinedUserIds }
                .forEach { bookmark ->
                    val recipient = users.findById(bookmark.userId).orElse(null) ?: return@forEach
                    if (recipient.deletedAt != null || !recipient.notifyCampaignUpdates) return@forEach
                    notifications.notify(
                        recipientUserId = bookmark.userId,
                        // 시드 캠페인은 개설자 미상(null) — self-skip 대상이 없다는 뜻이므로 sentinel 사용.
                        actorUserId = campaign.authorUserId ?: -1L,
                        type = NotificationType.CAMPAIGN_RECRUIT_ENDING,
                        title = "저장한 캠페인 모집이 내일 마감돼요",
                        body = campaign.title,
                        href = "/campaigns/${campaign.id}",
                    )
                    sent++
                }
            campaign.recruitEndReminderSentAt = now
        }
        return sent
    }

    private companion object {
        private val log = LoggerFactory.getLogger(CampaignReminderJob::class.java)
    }
}

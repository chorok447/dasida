package com.dasida.api.admin

import com.dasida.api.auth.UserRepository
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.post.PostRepository
import com.dasida.api.report.ReportRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * 관리자 통계. 가입·게시글·캠페인·신고의 일별 생성 건수를 집계한다.
 * 콘텐츠의 seq(epoch millis)와 사용자 createdAt 을 기간 필터로만 조회하고
 * 일 단위 버킷팅은 서버에서 처리해 H2/MySQL 간 date 함수 차이를 피한다.
 */
@Service
class AdminStatsService(
    private val users: UserRepository,
    private val posts: PostRepository,
    private val campaigns: CampaignRepository,
    private val reports: ReportRepository,
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun getDailyStats(days: Int): AdminStatsResponse {
        if (days < 1 || days > MAX_DAYS) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "days must be between 1 and $MAX_DAYS")
        }
        val today = Instant.now(clock).atZone(ZONE).toLocalDate()
        val start = today.minusDays(days - 1L)
        val since = start.atStartOfDay(ZONE).toInstant()

        val signups = users.signupTimesSince(since).groupingBy { it.toLocalDateAtZone() }.eachCount()
        val postCounts = posts.creationSeqSince(since.toEpochMilli()).groupingBy { it.toLocalDateAtZone() }.eachCount()
        val campaignCounts = campaigns.creationSeqSince(since.toEpochMilli()).groupingBy { it.toLocalDateAtZone() }.eachCount()
        val reportCounts = reports.creationSeqSince(since.toEpochMilli()).groupingBy { it.toLocalDateAtZone() }.eachCount()

        val daily = (0 until days).map { offset ->
            val date = start.plusDays(offset.toLong())
            AdminDailyStat(
                date = date.toString(),
                signups = (signups[date] ?: 0).toLong(),
                posts = (postCounts[date] ?: 0).toLong(),
                campaigns = (campaignCounts[date] ?: 0).toLong(),
                reports = (reportCounts[date] ?: 0).toLong(),
            )
        }
        return AdminStatsResponse(days = days, daily = daily)
    }

    private fun Instant.toLocalDateAtZone(): LocalDate = atZone(ZONE).toLocalDate()

    private fun Long.toLocalDateAtZone(): LocalDate = Instant.ofEpochMilli(this).atZone(ZONE).toLocalDate()

    companion object {
        internal const val MAX_DAYS = 90

        /** 일 버킷 기준 시간대. 운영·사용자 기반이 한국이라 KST 고정. */
        private val ZONE: ZoneId = ZoneId.of("Asia/Seoul")
    }
}

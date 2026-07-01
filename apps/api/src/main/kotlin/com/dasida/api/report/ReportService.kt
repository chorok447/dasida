package com.dasida.api.report

import com.dasida.api.campaign.CampaignCommentRepository
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.post.PostCommentRepository
import com.dasida.api.post.PostRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Clock
import java.time.Instant
import java.util.UUID

/**
 * 신고 도메인 서비스. 신고 생성/조회 비즈니스 정책(입력 검증, 대상 존재·소유권 확인,
 * 중복 방지, 트랜잭션)을 담당한다. Controller 에서 옮겨온 로직.
 */
@Service
class ReportService(
    private val reports: ReportRepository,
    private val posts: PostRepository,
    private val postComments: PostCommentRepository,
    private val campaigns: CampaignRepository,
    private val campaignComments: CampaignCommentRepository,
    private val clock: Clock,
) {
    @Transactional
    fun createReport(reporterUserId: Long, request: CreateReportRequest): ReportResponse {
        val targetType = enumValue<ReportTargetType>(request.targetType, "invalid report target type")
        val reason = enumValue<ReportReason>(request.reason, "invalid report reason")
        val targetId = request.targetId.trim()
        if (targetId.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "targetId is required")
        }
        val detail = request.detail?.trim()?.ifEmpty { null }
        if (detail != null && detail.length > MAX_DETAIL_LENGTH) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "detail must not exceed $MAX_DETAIL_LENGTH characters",
            )
        }

        val authorUserId = targetAuthorUserId(targetType, targetId)
        if (authorUserId == reporterUserId) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "cannot report own content")
        }
        if (reports.existsByReporterUserIdAndTargetTypeAndTargetId(reporterUserId, targetType.name, targetId)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "report already exists")
        }

        val now = Instant.now(clock)
        val report = Report(
            id = "report-${UUID.randomUUID()}",
            reporterUserId = reporterUserId,
            targetType = targetType.name,
            targetId = targetId,
            reason = reason.name,
            detail = detail,
            time = now.toString(),
            seq = now.toEpochMilli(),
        )
        return try {
            reports.saveAndFlush(report).toResponse()
        } catch (_: DataIntegrityViolationException) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "report already exists")
        }
    }

    @Transactional(readOnly = true)
    fun getMyReports(reporterUserId: Long, page: Int, size: Int): ReportsPageResponse {
        if (page < 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "page must not be negative")
        if (size !in 1..MAX_PAGE_SIZE) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be between 1 and $MAX_PAGE_SIZE")
        }
        val result = reports.findByReporterUserId(
            reporterUserId,
            PageRequest.of(
                page,
                size,
                Sort.by(Sort.Order.desc("seq"), Sort.Order.asc("id")),
            ),
        )
        return ReportsPageResponse(
            content = result.content.map(Report::toResponse),
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    private fun targetAuthorUserId(type: ReportTargetType, id: String): Long? = when (type) {
        ReportTargetType.POST -> posts.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "report target not found")
        }.authorUserId

        ReportTargetType.POST_COMMENT -> postComments.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "report target not found")
        }.authorUserId

        ReportTargetType.CAMPAIGN -> campaigns.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "report target not found")
        }.authorUserId

        ReportTargetType.CAMPAIGN_COMMENT -> campaignComments.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "report target not found")
        }.authorUserId
    }

    private inline fun <reified T : Enum<T>> enumValue(value: String, message: String): T =
        enumValues<T>().firstOrNull { it.name == value }
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, message)

    private companion object {
        const val MAX_DETAIL_LENGTH = 500
        const val MAX_PAGE_SIZE = 100
    }
}

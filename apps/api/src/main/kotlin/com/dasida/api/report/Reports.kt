package com.dasida.api.report

import com.dasida.api.campaign.CampaignCommentRepository
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.post.PostCommentRepository
import com.dasida.api.post.PostRepository
import com.dasida.api.security.AuthUser
import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.time.Clock
import java.time.Instant
import java.util.UUID

@Entity
@Table(
    name = "reports",
    uniqueConstraints = [
        UniqueConstraint(
            name = "uk_reports_reporter_target",
            columnNames = ["reporter_user_id", "target_type", "target_id"],
        ),
    ],
    indexes = [
        Index(name = "idx_reports_reporter_seq", columnList = "reporter_user_id, seq"),
        Index(name = "idx_reports_target", columnList = "target_type, target_id"),
        Index(name = "idx_reports_seq", columnList = "seq"),
    ],
)
class Report(
    @Id val id: String,
    @Column(name = "reporter_user_id", nullable = false) @JsonIgnore val reporterUserId: Long,
    @Column(name = "target_type", nullable = false) val targetType: String,
    @Column(name = "target_id", nullable = false) val targetId: String,
    @Column(nullable = false) val reason: String,
    @Column(columnDefinition = "TEXT") val detail: String?,
    @Column(name = "time_label", nullable = false) val time: String,
    @Column(nullable = false) val seq: Long,
)

interface ReportRepository : JpaRepository<Report, String> {
    fun existsByReporterUserIdAndTargetTypeAndTargetId(
        reporterUserId: Long,
        targetType: String,
        targetId: String,
    ): Boolean

    fun findByReporterUserId(reporterUserId: Long, pageable: Pageable): Page<Report>
}

enum class ReportTargetType {
    POST,
    POST_COMMENT,
    CAMPAIGN,
    CAMPAIGN_COMMENT,
}

enum class ReportReason {
    SPAM,
    ABUSE,
    INAPPROPRIATE,
    SCAM,
    OTHER,
}

data class CreateReportRequest(
    val targetType: String,
    val targetId: String,
    val reason: String,
    val detail: String? = null,
)

data class ReportResponse(
    val id: String,
    val targetType: String,
    val targetId: String,
    val reason: String,
    val detail: String?,
    val time: String,
)

data class ReportsPageResponse(
    val content: List<ReportResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

private fun Report.toResponse() = ReportResponse(
    id = id,
    targetType = targetType,
    targetId = targetId,
    reason = reason,
    detail = detail,
    time = time,
)

@RestController
@RequestMapping("/api/reports")
class ReportController(
    private val reports: ReportRepository,
    private val posts: PostRepository,
    private val postComments: PostCommentRepository,
    private val campaigns: CampaignRepository,
    private val campaignComments: CampaignCommentRepository,
    private val clock: Clock,
) {
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @RequestBody request: CreateReportRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): ReportResponse {
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
        if (authorUserId == user.id) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "cannot report own content")
        }
        if (reports.existsByReporterUserIdAndTargetTypeAndTargetId(user.id, targetType.name, targetId)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "report already exists")
        }

        val now = Instant.now(clock)
        val report = Report(
            id = "report-${UUID.randomUUID()}",
            reporterUserId = user.id,
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

    @GetMapping("/mine")
    @Transactional(readOnly = true)
    fun mine(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): ReportsPageResponse {
        if (page < 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "page must not be negative")
        if (size !in 1..MAX_PAGE_SIZE) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be between 1 and $MAX_PAGE_SIZE")
        }
        val result = reports.findByReporterUserId(
            user.id,
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

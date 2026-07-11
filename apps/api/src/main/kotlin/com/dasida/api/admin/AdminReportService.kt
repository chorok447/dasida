package com.dasida.api.admin

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import com.dasida.api.campaign.CampaignCommentRepository
import com.dasida.api.campaign.CampaignProofRepository
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.common.checkPageParams
import com.dasida.api.notification.NotificationService
import com.dasida.api.notification.NotificationType
import com.dasida.api.post.PostCommentRepository
import com.dasida.api.post.PostRepository
import com.dasida.api.report.Report
import com.dasida.api.report.ReportRepository
import com.dasida.api.report.ReportStatus
import com.dasida.api.report.ReportTargetType
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Clock
import java.time.Instant

/**
 * 관리자 신고 처리 서비스. 신고 큐 조회(대상 미리보기 포함)와 처리(제재 확정/기각)를 담당한다.
 * 처리 시 신고자에게 결과 알림을 생성한다(같은 트랜잭션).
 */
@Service
class AdminReportService(
    private val reports: ReportRepository,
    private val users: UserRepository,
    private val posts: PostRepository,
    private val postComments: PostCommentRepository,
    private val campaigns: CampaignRepository,
    private val campaignComments: CampaignCommentRepository,
    private val campaignProofs: CampaignProofRepository,
    private val notifications: NotificationService,
    private val content: AdminContentService,
    private val actionLogs: AdminActionLogService,
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun getReports(status: String?, targetType: String?, page: Int, size: Int): AdminReportsPageResponse {
        checkPageParams(page, size, MAX_PAGE_SIZE)
        val statusFilter = status?.takeIf { it.isNotBlank() }?.let {
            enumValue<ReportStatus>(it, "invalid report status").name
        }
        val targetTypeFilter = targetType?.takeIf { it.isNotBlank() }?.let {
            enumValue<ReportTargetType>(it, "invalid report target type").name
        }
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Order.desc("seq"), Sort.Order.asc("id")))
        val result: Page<Report> = when {
            statusFilter != null && targetTypeFilter != null ->
                reports.findByStatusAndTargetType(statusFilter, targetTypeFilter, pageable)
            statusFilter != null -> reports.findByStatus(statusFilter, pageable)
            targetTypeFilter != null -> reports.findByTargetType(targetTypeFilter, pageable)
            else -> reports.findAll(pageable)
        }
        // 신고자를 페이지 단위로 한 번에 로드해 행당 조회(N+1)를 없앤다.
        val reportersById = users.findAllById(result.content.map { it.reporterUserId }.toSet())
            .associateBy { it.id }
        return AdminReportsPageResponse(
            content = result.content.map { it.toAdminResponse(reportersById[it.reporterUserId]) },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
            pendingCount = reports.countByStatus(ReportStatus.PENDING.name),
        )
    }

    @Transactional
    fun resolveReport(adminUserId: Long, reportId: String, request: ResolveReportRequest): AdminReportResponse {
        val newStatus = enumValue<ReportStatus>(request.status, "invalid resolution status")
        if (newStatus == ReportStatus.PENDING) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "resolution status must be RESOLVED or DISMISSED")
        }
        val note = request.note?.trim()?.ifEmpty { null }
        if (note != null && note.length > MAX_NOTE_LENGTH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "note must not exceed $MAX_NOTE_LENGTH characters")
        }
        val report = reports.findById(reportId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "report not found")
        }
        if (report.status != ReportStatus.PENDING.name) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "report already processed")
        }

        report.status = newStatus.name
        report.resolvedByUserId = adminUserId
        report.resolvedAt = Instant.now(clock)
        report.resolutionNote = note
        val action = if (newStatus == ReportStatus.RESOLVED) AdminActionType.REPORT_RESOLVED else AdminActionType.REPORT_DISMISSED
        actionLogs.record(adminUserId, action, TARGET_TYPE_REPORT, reportId, note)
        // 제재 확정 시 대상 콘텐츠 숨김까지 한 번에 처리. 대상이 이미 삭제됐으면 조용히 넘어간다.
        if (newStatus == ReportStatus.RESOLVED && request.hideContent) {
            val type = runCatching { ReportTargetType.valueOf(report.targetType) }.getOrNull()
            if (type != null) {
                try {
                    // 실제로 숨긴 경우에만 기록한다(직접 숨김 경로의 setVisibility 와 같은 기준).
                    if (content.hide(type, report.targetId, note)) {
                        actionLogs.record(adminUserId, AdminActionType.CONTENT_HIDDEN, type.name, report.targetId, note)
                    }
                } catch (e: ResponseStatusException) {
                    if (e.statusCode != HttpStatus.NOT_FOUND) throw e
                }
            }
        }
        notifyReporter(report, newStatus, note)
        return report.toAdminResponse()
    }

    @Transactional(readOnly = true)
    fun getSummary(): AdminSummaryResponse = AdminSummaryResponse(
        users = users.countByDeletedAtIsNull(),
        posts = posts.count(),
        campaigns = campaigns.count(),
        pendingReports = reports.countByStatus(ReportStatus.PENDING.name),
        totalReports = reports.count(),
        suspendedUsers = users.countBySuspendedUntilAfter(Instant.now(clock)),
    )

    /** 처리 결과를 신고자에게 알린다. 신고자가 탈퇴했으면 생략. */
    private fun notifyReporter(report: Report, status: ReportStatus, note: String?) {
        val reporter = users.findById(report.reporterUserId).orElse(null)
        if (reporter == null || reporter.deletedAt != null) return
        val summary = if (status == ReportStatus.RESOLVED) {
            "신고하신 콘텐츠에 대한 조치가 완료되었습니다."
        } else {
            "검토 결과 신고하신 콘텐츠는 정책 위반에 해당하지 않았습니다."
        }
        notifications.notifyUser(
            recipientUserId = report.reporterUserId,
            type = NotificationType.REPORT_RESOLVED,
            title = "신고 처리 결과 안내",
            body = if (note != null) "$summary ($note)" else summary,
            href = targetPreview(report)?.href ?: fallbackHref(report),
        )
    }

    // reporter 를 넘기지 않는 단건 경로(resolveReport)는 기존대로 개별 조회한다.
    private fun Report.toAdminResponse(
        reporter: User? = users.findById(reporterUserId).orElse(null),
    ): AdminReportResponse = AdminReportResponse(
        id = id,
        targetType = targetType,
        targetId = targetId,
        reason = reason,
        detail = detail,
        time = time,
        status = status,
        resolutionNote = resolutionNote,
        resolvedAt = resolvedAt?.toString(),
        reporter = reporterResponse(reporterUserId, reporter),
        target = targetPreview(this),
        targetReportCount = reports.countByTargetTypeAndTargetId(targetType, targetId),
    )

    private fun reporterResponse(reporterUserId: Long, user: User?): AdminReportUserResponse =
        AdminReportUserResponse(
            id = reporterUserId,
            name = user?.name ?: "알 수 없음",
            // 탈퇴 계정 이메일은 익명화된 placeholder 라 노출 의미가 없다.
            email = user?.takeIf { it.deletedAt == null }?.email,
        )

    /** 신고 대상 미리보기. 대상이 이미 삭제됐으면 null(프론트는 "삭제된 콘텐츠"로 표시). */
    private fun targetPreview(report: Report): AdminReportTargetResponse? {
        val type = runCatching { ReportTargetType.valueOf(report.targetType) }.getOrNull() ?: return null
        return when (type) {
            ReportTargetType.POST -> posts.findById(report.targetId).orElse(null)?.let {
                AdminReportTargetResponse(excerpt(it.text), it.author.name, "/posts/${it.id}", hidden = it.hiddenAt != null)
            }

            ReportTargetType.POST_COMMENT -> postComments.findById(report.targetId).orElse(null)?.let {
                AdminReportTargetResponse(excerpt(it.text), it.author.name, "/posts/${it.postId}", hidden = it.hiddenAt != null)
            }

            ReportTargetType.CAMPAIGN -> campaigns.findById(report.targetId).orElse(null)?.let {
                AdminReportTargetResponse(
                    excerpt("${it.title} — ${it.summary}"),
                    it.author.name,
                    "/campaigns/${it.id}",
                    hidden = it.hiddenAt != null,
                )
            }

            ReportTargetType.CAMPAIGN_COMMENT -> campaignComments.findById(report.targetId).orElse(null)?.let {
                AdminReportTargetResponse(excerpt(it.text), it.author.name, "/campaigns/${it.campaignId}", hidden = it.hiddenAt != null)
            }

            ReportTargetType.CAMPAIGN_PROOF -> campaignProofs.findById(report.targetId).orElse(null)?.let {
                AdminReportTargetResponse(
                    excerpt(it.text),
                    it.author.name,
                    "/campaigns/${it.campaignId}?tab=proofs",
                    hidden = it.hiddenAt != null,
                )
            }
        }
    }

    private fun fallbackHref(report: Report): String = when (report.targetType) {
        ReportTargetType.CAMPAIGN.name, ReportTargetType.CAMPAIGN_COMMENT.name -> "/campaigns"
        else -> "/feed"
    }

    /** 본문 발췌: 리치 에디터 HTML 태그 제거 후 공백 정리, 최대 200자. */
    private fun excerpt(raw: String): String {
        val text = raw.replace(TAG_RE, " ").replace(WS_RE, " ").trim()
        return if (text.length <= MAX_EXCERPT_LENGTH) text else text.take(MAX_EXCERPT_LENGTH) + "…"
    }

    private inline fun <reified T : Enum<T>> enumValue(value: String, message: String): T =
        try {
            enumValueOf<T>(value.trim())
        } catch (_: IllegalArgumentException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, message)
        }

    private companion object {
        const val TARGET_TYPE_REPORT = "REPORT"
        const val MAX_PAGE_SIZE = 100
        const val MAX_NOTE_LENGTH = 500
        const val MAX_EXCERPT_LENGTH = 200
        val TAG_RE = Regex("<[^>]*>")
        val WS_RE = Regex("\\s+")
    }
}

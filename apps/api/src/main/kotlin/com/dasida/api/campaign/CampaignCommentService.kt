package com.dasida.api.campaign

import com.dasida.api.auth.UserRepository
import com.dasida.api.auth.findActiveOrThrow
import com.dasida.api.auth.toAuthorSnapshot
import com.dasida.api.common.CommentPageLocationResponse
import com.dasida.api.common.checkPageParams
import com.dasida.api.common.checkPageSize
import com.dasida.api.notification.NotificationService
import com.dasida.api.notification.NotificationType
import com.dasida.api.security.AuthUser
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
 * 캠페인 댓글 도메인 서비스. 댓글 목록/pagination/딥링크 위치 조회와 작성/수정/삭제 정책을 담당한다.
 * Controller 에서 옮겨온 validation, 소유권 검증, row lock, 알림 생성, 트랜잭션을 이 계층에 둔다.
 */
@Service
class CampaignCommentService(
    private val campaigns: CampaignRepository,
    private val comments: CampaignCommentRepository,
    private val users: UserRepository,
    private val notifications: NotificationService,
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun listComments(campaignId: String, currentUserId: Long?, page: Int, size: Int): CampaignCommentsResponse {
        checkPageParams(page, size, MAX_PAGE_SIZE)
        requireViewableCampaign(campaignId, currentUserId)

        val result = comments.findByCampaignIdAndHiddenAtIsNull(
            campaignId,
            PageRequest.of(
                page,
                size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.asc("id")),
            ),
        )
        return CampaignCommentsResponse(
            content = result.content.map { it.toResponse(currentUserId) },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    /** 최신순 댓글 pagination과 같은 정렬 기준으로 대상 댓글이 속한 page를 계산한다. */
    @Transactional(readOnly = true)
    fun getCommentPageLocation(campaignId: String, commentId: String, size: Int): CommentPageLocationResponse {
        checkPageSize(size, MAX_PAGE_SIZE)
        if (!campaigns.existsById(campaignId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }
        val target = comments.findByIdAndCampaignId(commentId, campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        if (target.hiddenAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        }
        val commentsBefore = comments.countBeforeInNewestOrder(campaignId, target.createdAt, target.id)
        return CommentPageLocationResponse(
            commentId = target.id,
            page = (commentsBefore / size).toInt(),
            size = size,
        )
    }

    @Transactional
    fun createComment(user: AuthUser, campaignId: String, request: CreateCampaignCommentRequest): CampaignCommentResponse {
        val text = normalizeCampaignCommentText(request.text)
        // 캠페인 삭제와 같은 row를 첫 DB 조회로 잠가 orphan comment 생성을 막는다.
        val campaign = campaigns.findByIdForUpdate(campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        // 숨김 캠페인에는 새 댓글을 받지 않는다(개설자 포함).
        if (campaign.hiddenAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }

        val authorSnapshot = users.findActiveOrThrow(user.id).toAuthorSnapshot()
        val saved = comments.save(
            CampaignComment(
                id = "cc-${UUID.randomUUID()}",
                campaignId = campaignId,
                author = authorSnapshot,
                text = text,
                createdAt = Instant.now(clock),
                authorUserId = user.id,
            ),
        )
        // 내가 개설한 캠페인에 타인이 댓글 → 개설자에게 알림(본인 댓글/개설자 미상은 helper 가 생략).
        notifications.notify(
            recipientUserId = campaign.authorUserId,
            actorUserId = user.id,
            type = NotificationType.CAMPAIGN_COMMENT_CREATED,
            title = "${authorSnapshot.name}님이 캠페인에 댓글을 남겼습니다",
            body = campaign.title,
            href = "/campaigns/$campaignId?commentId=${saved.id}",
        )
        return saved.toResponse(user.id)
    }

    /** 댓글 수정은 생성 시각과 정렬을 유지하고 text와 updatedAt만 갱신한다. */
    @Transactional
    fun updateComment(userId: Long, campaignId: String, commentId: String, request: UpdateCampaignCommentRequest): CampaignCommentResponse {
        if (!campaigns.existsById(campaignId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }
        val comment = comments.findByIdAndCampaignId(commentId, campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        // 숨김 댓글은 작성자에게도 수정 불가(존재를 드러내지 않는 404).
        if (comment.hiddenAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        }
        if (comment.authorUserId == null || comment.authorUserId != userId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the comment owner")
        }
        comment.text = normalizeCampaignCommentText(request.text)
        comment.updatedAt = Instant.now(clock)
        return comment.toResponse(userId)
    }

    @Transactional
    fun deleteComment(userId: Long, campaignId: String, commentId: String) {
        // 작성·캠페인 삭제와 lock 순서를 맞추기 위해 campaign row를 가장 먼저 잠근다.
        campaigns.findByIdForUpdate(campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        val comment = comments.findByIdAndCampaignId(commentId, campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        if (comment.authorUserId == null || comment.authorUserId != userId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the comment owner")
        }
        comments.delete(comment)
    }

    /** 공개 조회 경로에서 캠페인 존재·노출 여부 확인. 숨김 캠페인은 개설자에게만 보인다. */
    private fun requireViewableCampaign(campaignId: String, currentUserId: Long?) {
        val campaign = campaigns.findById(campaignId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }
        if (campaign.hiddenAt != null && (campaign.authorUserId == null || campaign.authorUserId != currentUserId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }
    }

    private companion object {
        const val MAX_PAGE_SIZE = 100
    }
}

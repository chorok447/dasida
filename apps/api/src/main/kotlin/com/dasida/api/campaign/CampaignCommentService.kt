package com.dasida.api.campaign

import com.dasida.api.common.CommentPageLocationResponse
import com.dasida.api.notification.NotificationService
import com.dasida.api.notification.NotificationType
import com.dasida.api.post.Author
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
    private val notifications: NotificationService,
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun listComments(campaignId: String, currentUserId: Long?, page: Int, size: Int): CampaignCommentsResponse {
        if (page < 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "page must not be negative")
        if (size !in 1..MAX_PAGE_SIZE) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be between 1 and $MAX_PAGE_SIZE")
        }
        if (!campaigns.existsById(campaignId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }

        val result = comments.findByCampaignId(
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
        if (size !in 1..MAX_PAGE_SIZE) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be between 1 and $MAX_PAGE_SIZE")
        }
        if (!campaigns.existsById(campaignId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }
        val target = comments.findByIdAndCampaignId(commentId, campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
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

        val saved = comments.save(
            CampaignComment(
                id = "cc-${UUID.randomUUID()}",
                campaignId = campaignId,
                author = Author(user.name, user.verified),
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
            title = "${user.name}님이 캠페인에 댓글을 남겼습니다",
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

    private companion object {
        const val MAX_PAGE_SIZE = 100
    }
}

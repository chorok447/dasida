package com.dasida.api.campaign

import com.dasida.api.common.CommentPageLocationResponse
import com.dasida.api.notification.NotificationService
import com.dasida.api.notification.NotificationType
import com.dasida.api.post.Author
import com.dasida.api.security.AuthUser
import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
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
    name = "campaign_comments",
    indexes = [
        Index(
            name = "idx_campaign_comments_campaign_created",
            columnList = "campaign_id, created_at",
        ),
    ],
)
class CampaignComment(
    @Id val id: String,
    @Column(name = "campaign_id") val campaignId: String,
    @Embedded val author: Author,
    @Column(columnDefinition = "TEXT") var text: String,
    @Column(name = "created_at") val createdAt: Instant,
    @Column(name = "author_user_id") @JsonIgnore val authorUserId: Long? = null,
    @Column(name = "updated_at") var updatedAt: Instant? = null,
)

interface CampaignCommentRepository : JpaRepository<CampaignComment, String> {
    fun findByCampaignId(campaignId: String, pageable: Pageable): Page<CampaignComment>
    fun findByIdAndCampaignId(id: String, campaignId: String): CampaignComment?

    @Query(
        """
        select count(c) from CampaignComment c
        where c.campaignId = :campaignId
          and (c.createdAt > :createdAt or (c.createdAt = :createdAt and c.id < :id))
        """,
    )
    fun countBeforeInNewestOrder(
        @Param("campaignId") campaignId: String,
        @Param("createdAt") createdAt: Instant,
        @Param("id") id: String,
    ): Long

    fun countByCampaignId(campaignId: String): Long

    @Transactional
    fun deleteByCampaignId(campaignId: String)
}

data class CampaignCommentResponse(
    val id: String,
    val campaignId: String,
    val author: Author,
    val text: String,
    val createdAt: Instant,
    val ownedByMe: Boolean,
    val edited: Boolean,
    val updatedAt: Instant?,
)

data class CampaignCommentsResponse(
    val content: List<CampaignCommentResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

data class CreateCampaignCommentRequest(val text: String)
data class UpdateCampaignCommentRequest(val text: String)

@RestController
@RequestMapping("/api/campaigns/{campaignId}/comments")
class CampaignCommentController(
    private val campaigns: CampaignRepository,
    private val comments: CampaignCommentRepository,
    private val notifications: NotificationService,
    private val clock: Clock,
) {
    @GetMapping
    @Transactional(readOnly = true)
    fun list(
        @PathVariable campaignId: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @AuthenticationPrincipal user: AuthUser?,
    ): CampaignCommentsResponse {
        validatePage(page, size)
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
            content = result.content.map { it.toResponse(user?.id) },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    /** 최신순 댓글 pagination과 같은 정렬 기준으로 대상 댓글이 속한 page를 계산한다. */
    @GetMapping("/{commentId}/page")
    @Transactional(readOnly = true)
    fun location(
        @PathVariable campaignId: String,
        @PathVariable commentId: String,
        @RequestParam(defaultValue = "20") size: Int,
    ): CommentPageLocationResponse {
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

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    fun create(
        @PathVariable campaignId: String,
        @RequestBody request: CreateCampaignCommentRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignCommentResponse {
        val text = normalizeText(request.text)
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
    @PutMapping("/{commentId}")
    @Transactional
    fun update(
        @PathVariable campaignId: String,
        @PathVariable commentId: String,
        @RequestBody request: UpdateCampaignCommentRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignCommentResponse {
        if (!campaigns.existsById(campaignId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }
        val comment = comments.findByIdAndCampaignId(commentId, campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        if (comment.authorUserId == null || comment.authorUserId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the comment owner")
        }
        comment.text = normalizeText(request.text)
        comment.updatedAt = Instant.now(clock)
        return comment.toResponse(user.id)
    }

    @DeleteMapping("/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    fun delete(
        @PathVariable campaignId: String,
        @PathVariable commentId: String,
        @AuthenticationPrincipal user: AuthUser,
    ) {
        // 작성·캠페인 삭제와 lock 순서를 맞추기 위해 campaign row를 가장 먼저 잠근다.
        campaigns.findByIdForUpdate(campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        val comment = comments.findByIdAndCampaignId(commentId, campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        if (comment.authorUserId == null || comment.authorUserId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the comment owner")
        }
        comments.delete(comment)
    }

    private fun validatePage(page: Int, size: Int) {
        if (page < 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "page must not be negative")
        if (size !in 1..MAX_PAGE_SIZE) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be between 1 and $MAX_PAGE_SIZE")
        }
    }

    private fun normalizeText(value: String): String {
        val text = value.trim()
        if (text.isEmpty()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "text is required")
        if (text.length > MAX_TEXT_LENGTH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "text must not exceed $MAX_TEXT_LENGTH characters")
        }
        return text
    }

    private fun CampaignComment.toResponse(viewerId: Long?) = CampaignCommentResponse(
        id = id,
        campaignId = campaignId,
        author = author,
        text = text,
        createdAt = createdAt,
        ownedByMe = authorUserId != null && authorUserId == viewerId,
        edited = updatedAt != null,
        updatedAt = updatedAt,
    )

    private companion object {
        const val MAX_PAGE_SIZE = 100
        const val MAX_TEXT_LENGTH = 500
    }
}

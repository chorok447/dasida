package com.dasida.api.admin

import com.dasida.api.auth.UserRepository
import com.dasida.api.campaign.CampaignCommentRepository
import com.dasida.api.campaign.CampaignProofRepository
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.notification.NotificationService
import com.dasida.api.notification.NotificationType
import com.dasida.api.post.PostCommentRepository
import com.dasida.api.post.PostRepository
import com.dasida.api.report.ReportTargetType
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Clock
import java.time.Instant

/**
 * 관리자 콘텐츠 숨김/복구 서비스. 삭제 대신 soft hide(hiddenAt)를 써서 처리 실수를 되돌릴 수 있게 한다.
 * 숨김/복구가 실제로 상태를 바꾼 경우에만 작성자에게 알림을 보낸다(멱등 재요청은 무음).
 * 게시글 댓글은 post.comments 카운터와 정합을 맞춘다(숨김 시 감소, 복구 시 증가).
 */
@Service
class AdminContentService(
    private val posts: PostRepository,
    private val postComments: PostCommentRepository,
    private val campaigns: CampaignRepository,
    private val campaignComments: CampaignCommentRepository,
    private val campaignProofs: CampaignProofRepository,
    private val users: UserRepository,
    private val notifications: NotificationService,
    private val actionLogs: AdminActionLogService,
    private val clock: Clock,
    private val entityManager: jakarta.persistence.EntityManager,
) {
    @Transactional
    fun setVisibility(
        adminUserId: Long,
        targetTypeRaw: String,
        targetId: String,
        request: SetContentVisibilityRequest,
    ): ContentVisibilityResponse {
        val targetType = try {
            ReportTargetType.valueOf(targetTypeRaw.trim())
        } catch (_: IllegalArgumentException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid content target type")
        }
        val reason = request.reason?.trim()?.ifEmpty { null }
        if (reason != null && reason.length > MAX_REASON_LENGTH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "reason must not exceed $MAX_REASON_LENGTH characters")
        }
        val changed = if (request.hidden) hide(targetType, targetId, reason) else unhide(targetType, targetId)
        // 알림과 같은 기준: 실제로 상태가 바뀐 경우에만 기록한다(멱등 재요청은 무음).
        if (changed) {
            val action = if (request.hidden) AdminActionType.CONTENT_HIDDEN else AdminActionType.CONTENT_RESTORED
            actionLogs.record(adminUserId, action, targetType.name, targetId, reason)
        }
        return ContentVisibilityResponse(targetType.name, targetId, request.hidden)
    }

    /** 대상을 숨긴다. 이미 숨김이면 no-op(멱등). 대상이 없으면 404. 실제로 숨겼으면 true. */
    fun hide(targetType: ReportTargetType, targetId: String, reason: String?): Boolean {
        val now = Instant.now(clock)
        when (targetType) {
            ReportTargetType.POST -> {
                val post = posts.findByIdForUpdate(targetId) ?: throw notFound()
                if (post.hiddenAt != null) return false
                post.hiddenAt = now
                post.hiddenReason = reason
                // 숨겨진 게시글 상세는 웹에서 열리지 않으므로 알림은 마이페이지로 보낸다.
                notifyAuthor(post.authorUserId, hidden = true, label = "게시글", href = "/mypage", reason = reason)
            }

            ReportTargetType.POST_COMMENT -> {
                val comment = postComments.findById(targetId).orElseThrow { notFound() }
                // 카운터 정합: 댓글 작성/삭제와 같은 순서로 post row 를 먼저 잠근 뒤 댓글을 다시 읽는다.
                // (잠금 대기 중 작성자 삭제가 커밋되면 stale 스냅샷으로 이중 감소·deletedAt 덮어쓰기가 나던 경쟁 방지)
                val post = posts.findByIdForUpdate(comment.postId)
                entityManager.refresh(comment)
                if (comment.deletedAt != null) throw notFound()
                if (comment.hiddenAt != null) return false
                // 최상위 댓글이면 보이는 답글도 함께 숨긴다 — 부모만 숨기면 flat API 에는 남고
                // paged API 에서는 사라지는 고아 답글이 생기며 counter 도 어긋난다(deleteComment 와 동일 정책).
                val replies = if (comment.parentId == null) {
                    postComments.findByParentId(comment.id).filter { it.deletedAt == null && it.hiddenAt == null }
                } else {
                    emptyList()
                }
                comment.hiddenAt = now
                comment.hiddenReason = reason
                replies.forEach {
                    it.hiddenAt = now
                    it.hiddenReason = reason
                }
                post?.let { it.comments = maxOf(0, it.comments - 1 - replies.size) }
                notifyAuthor(comment.authorUserId, hidden = true, label = "댓글", href = "/posts/${comment.postId}", reason = reason)
            }

            ReportTargetType.CAMPAIGN -> {
                val campaign = campaigns.findByIdForUpdate(targetId) ?: throw notFound()
                if (campaign.hiddenAt != null) return false
                campaign.hiddenAt = now
                campaign.hiddenReason = reason
                // 숨겨진 캠페인 상세는 웹에서 열리지 않으므로 알림은 마이페이지로 보낸다.
                notifyAuthor(campaign.authorUserId, hidden = true, label = "캠페인", href = "/mypage", reason = reason)
            }

            ReportTargetType.CAMPAIGN_COMMENT -> {
                val comment = campaignComments.findById(targetId).orElseThrow { notFound() }
                if (comment.deletedAt != null) throw notFound()
                if (comment.hiddenAt != null) return false
                // 게시글 댓글과 동일: 최상위 댓글 숨김 시 보이는 답글도 함께 숨긴다(고아 답글 방지).
                val replies = if (comment.parentId == null) {
                    campaignComments.findByParentId(comment.id).filter { it.deletedAt == null && it.hiddenAt == null }
                } else {
                    emptyList()
                }
                comment.hiddenAt = now
                comment.hiddenReason = reason
                replies.forEach {
                    it.hiddenAt = now
                    it.hiddenReason = reason
                }
                notifyAuthor(comment.authorUserId, hidden = true, label = "댓글", href = "/campaigns/${comment.campaignId}", reason = reason)
            }

            ReportTargetType.CAMPAIGN_PROOF -> {
                val proof = campaignProofs.findById(targetId).orElseThrow { notFound() }
                if (proof.deletedAt != null) throw notFound()
                if (proof.hiddenAt != null) return false
                proof.hiddenAt = now
                proof.hiddenReason = reason
                notifyAuthor(proof.authorUserId, hidden = true, label = "참여 인증", href = "/campaigns/${proof.campaignId}?tab=proofs", reason = reason)
            }
        }
        return true
    }

    /**
     * 숨김을 해제한다. 이미 공개면 no-op(멱등). 대상이 없으면 404. 실제로 복구했으면 true.
     * 작성자가 삭제(soft delete)한 콘텐츠는 존재하지 않는 것으로 취급해 복구할 수 없다
     * (hiddenAt 만 지우면 삭제된 콘텐츠가 다시 공개되기 때문).
     */
    fun unhide(targetType: ReportTargetType, targetId: String): Boolean {
        when (targetType) {
            ReportTargetType.POST -> {
                val post = posts.findByIdForUpdate(targetId) ?: throw notFound()
                if (post.deletedAt != null) throw notFound()
                if (post.hiddenAt == null) return false
                post.hiddenAt = null
                post.hiddenReason = null
                notifyAuthor(post.authorUserId, hidden = false, label = "게시글", href = "/posts/${post.id}", reason = null)
            }

            ReportTargetType.POST_COMMENT -> {
                val comment = postComments.findById(targetId).orElseThrow { notFound() }
                val post = posts.findByIdForUpdate(comment.postId)
                entityManager.refresh(comment)
                if (comment.deletedAt != null) throw notFound()
                if (comment.hiddenAt == null) return false
                // 숨김 시 함께 숨겨진 답글(hiddenAt 이 부모와 동일)만 같이 복구한다 —
                // 개별적으로 먼저 숨겨졌던 답글은 그대로 둔다.
                val parentHiddenAt = comment.hiddenAt
                val replies = if (comment.parentId == null) {
                    postComments.findByParentId(comment.id).filter { it.deletedAt == null && it.hiddenAt == parentHiddenAt }
                } else {
                    emptyList()
                }
                comment.hiddenAt = null
                comment.hiddenReason = null
                replies.forEach {
                    it.hiddenAt = null
                    it.hiddenReason = null
                }
                post?.let { it.comments += 1 + replies.size }
                notifyAuthor(comment.authorUserId, hidden = false, label = "댓글", href = "/posts/${comment.postId}", reason = null)
            }

            ReportTargetType.CAMPAIGN -> {
                val campaign = campaigns.findByIdForUpdate(targetId) ?: throw notFound()
                if (campaign.deletedAt != null) throw notFound()
                if (campaign.hiddenAt == null) return false
                campaign.hiddenAt = null
                campaign.hiddenReason = null
                notifyAuthor(campaign.authorUserId, hidden = false, label = "캠페인", href = "/campaigns/${campaign.id}", reason = null)
            }

            ReportTargetType.CAMPAIGN_COMMENT -> {
                val comment = campaignComments.findById(targetId).orElseThrow { notFound() }
                if (comment.deletedAt != null) throw notFound()
                if (comment.hiddenAt == null) return false
                val parentHiddenAt = comment.hiddenAt
                val replies = if (comment.parentId == null) {
                    campaignComments.findByParentId(comment.id).filter { it.deletedAt == null && it.hiddenAt == parentHiddenAt }
                } else {
                    emptyList()
                }
                comment.hiddenAt = null
                comment.hiddenReason = null
                replies.forEach {
                    it.hiddenAt = null
                    it.hiddenReason = null
                }
                notifyAuthor(comment.authorUserId, hidden = false, label = "댓글", href = "/campaigns/${comment.campaignId}", reason = null)
            }

            ReportTargetType.CAMPAIGN_PROOF -> {
                val proof = campaignProofs.findById(targetId).orElseThrow { notFound() }
                // 작성자가 삭제한 인증은 복구 불가(다른 콘텐츠 타입과 동일).
                if (proof.deletedAt != null) throw notFound()
                if (proof.hiddenAt == null) return false
                proof.hiddenAt = null
                proof.hiddenReason = null
                notifyAuthor(proof.authorUserId, hidden = false, label = "참여 인증", href = "/campaigns/${proof.campaignId}?tab=proofs", reason = null)
            }
        }
        return true
    }

    /** 작성자에게 숨김/복구를 알린다. 시드 콘텐츠(작성자 미상)·탈퇴 사용자는 생략. */
    private fun notifyAuthor(authorUserId: Long?, hidden: Boolean, label: String, href: String, reason: String?) {
        if (authorUserId == null) return
        val author = users.findById(authorUserId).orElse(null)
        if (author == null || author.deletedAt != null) return
        if (hidden) {
            val body = buildString {
                append("운영 정책 위반으로 회원님의 ").append(label).append("이 숨김 처리되었습니다.")
                if (reason != null) append(" 사유: ").append(reason)
            }
            notifications.notifyUser(authorUserId, NotificationType.CONTENT_HIDDEN, "콘텐츠 숨김 안내", body, href)
        } else {
            notifications.notifyUser(
                authorUserId,
                NotificationType.CONTENT_RESTORED,
                "콘텐츠 숨김 해제 안내",
                "회원님의 ${label}이 다시 공개되었습니다.",
                href,
            )
        }
    }

    private fun notFound() = ResponseStatusException(HttpStatus.NOT_FOUND, "content not found")

    private companion object {
        const val MAX_REASON_LENGTH = 500
    }
}

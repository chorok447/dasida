package com.dasida.api.post

import com.dasida.api.auth.UserRepository
import com.dasida.api.auth.findActiveOrThrow
import com.dasida.api.auth.toAuthorSnapshot
import com.dasida.api.common.CommentPageLocationResponse
import com.dasida.api.common.checkPageParams
import com.dasida.api.common.checkPageSize
import com.dasida.api.notification.CommentMentionNotifier
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
 * 게시글 댓글 도메인 서비스. 댓글 목록/pagination/딥링크 위치 조회와 작성/수정/삭제 정책을 담당한다.
 * Controller 에서 옮겨온 validation, 소유권 검증, 동시성 lock, 알림 생성, 트랜잭션을 이 계층에 둔다.
 */
@Service
class PostCommentService(
    private val repo: PostRepository,
    private val commentRepo: PostCommentRepository,
    private val users: UserRepository,
    private val notifications: NotificationService,
    private val mentions: CommentMentionNotifier,
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun listComments(postId: String, currentUserId: Long?): List<PostCommentResponse> {
        requireViewablePost(postId, currentUserId)
        return commentRepo.findByPostIdAndHiddenAtIsNullOrderBySeqAsc(postId).map { it.toResponse(currentUserId) }
    }

    /** 기존 배열 API는 유지하고 상세 화면용 최신순 pagination을 별도 경로로 제공한다. 최상위 댓글 기준으로 페이징하고 답글은 중첩한다. */
    @Transactional(readOnly = true)
    fun listCommentsPage(postId: String, currentUserId: Long?, page: Int, size: Int): PostCommentsPageResponse {
        checkPageParams(page, size, MAX_COMMENT_PAGE_SIZE)
        requireViewablePost(postId, currentUserId)

        val result = commentRepo.findByPostIdAndParentIdIsNullAndHiddenAtIsNull(
            postId,
            PageRequest.of(
                page,
                size,
                Sort.by(Sort.Order.desc("seq"), Sort.Order.asc("id")),
            ),
        )
        val parentIds = result.content.map { it.id }
        val repliesByParent = if (parentIds.isEmpty()) {
            emptyMap()
        } else {
            commentRepo.findByParentIdInAndHiddenAtIsNullOrderBySeqAscIdAsc(parentIds).groupBy { it.parentId }
        }
        return PostCommentsPageResponse(
            content = result.content.map { comment ->
                comment.toResponse(
                    currentUserId,
                    replies = (repliesByParent[comment.id] ?: emptyList()).map { it.toResponse(currentUserId) },
                )
            },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
            totalComments = commentRepo.countByPostIdAndHiddenAtIsNull(postId),
        )
    }

    /** 최신순 댓글 pagination과 같은 정렬 기준으로 대상 댓글이 속한 page를 계산한다. */
    @Transactional(readOnly = true)
    fun getCommentPageLocation(postId: String, currentUserId: Long?, commentId: String, size: Int): CommentPageLocationResponse {
        checkPageSize(size, MAX_COMMENT_PAGE_SIZE)
        // 목록 조회와 같은 노출 규칙 — 숨김 게시글의 댓글 위치가 익명에게 200 으로 새지 않게 한다.
        requireViewablePost(postId, currentUserId)
        val target = commentRepo.findByIdAndPostId(commentId, postId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        if (target.hiddenAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        }
        // 답글은 최상위 부모의 page 에 함께 표시되므로 부모 기준으로 위치를 계산한다.
        val anchor = target.parentId?.let { parentId ->
            val parent = commentRepo.findByIdAndPostId(parentId, postId)
            if (parent == null || parent.hiddenAt != null) {
                throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
            }
            parent
        } ?: target
        val commentsBefore = commentRepo.countBeforeInNewestOrder(postId, anchor.seq, anchor.id)
        return CommentPageLocationResponse(
            commentId = target.id,
            page = (commentsBefore / size).toInt(),
            size = size,
        )
    }

    @Transactional
    fun createComment(postId: String, author: AuthUser, req: CreateCommentRequest): PostCommentResponse {
        // write lock 으로 직렬화 → 서로 다른 유저의 동시 댓글 작성에서도 comments 증가가 유실되지 않음.
        val post = repo.findByIdForUpdate(postId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        // 숨김 게시글에는 새 댓글을 받지 않는다(작성자 포함).
        if (post.hiddenAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        }
        val text = normalizeCommentText(req.text)
        // 답글이면 부모가 같은 게시글의 노출 중인 최상위 댓글인지 확인한다(1단계 제한).
        val parent = req.parentId?.let { parentId ->
            val found = commentRepo.findByIdAndPostId(parentId, postId)
            if (found == null || found.hiddenAt != null) {
                throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $parentId not found")
            }
            if (found.parentId != null) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "cannot reply to a reply")
            }
            found
        }
        val authorSnapshot = users.findActiveOrThrow(author.id).toAuthorSnapshot()
        val comment = commentRepo.save(
            PostComment(
                id = "pc-${UUID.randomUUID()}",
                postId = postId,
                author = authorSnapshot,
                text = text,
                time = "방금 전",
                seq = System.currentTimeMillis(),
                authorUserId = author.id,
                parentId = parent?.id,
            ),
        )
        post.comments += 1
        if (parent != null) {
            // 답글은 부모 댓글 작성자에게 알린다(본인 답글/작성자 미상은 helper 가 생략).
            notifications.notify(
                recipientUserId = parent.authorUserId,
                actorUserId = author.id,
                type = NotificationType.COMMENT_REPLY_CREATED,
                title = "${authorSnapshot.name}님이 내 댓글에 답글을 남겼습니다",
                body = text,
                href = "/posts/$postId?commentId=${comment.id}",
            )
        } else {
            // 내 게시글에 타인이 댓글 → 게시글 작성자에게 알림(본인 댓글/작성자 미상은 helper 가 생략).
            notifications.notify(
                recipientUserId = post.authorUserId,
                actorUserId = author.id,
                type = NotificationType.POST_COMMENT_CREATED,
                title = "${authorSnapshot.name}님이 내 게시글에 댓글을 남겼습니다",
                body = text,
                href = "/posts/$postId?commentId=${comment.id}",
            )
        }
        // @멘션된 사용자에게 알림. 위에서 이미 댓글/답글 알림을 받은 수신자는 제외해 중복을 막는다.
        mentions.notifyMentions(
            text = text,
            actorUserId = author.id,
            actorName = authorSnapshot.name,
            href = "/posts/$postId?commentId=${comment.id}",
            excludeUserIds = setOfNotNull(parent?.authorUserId ?: post.authorUserId),
        )
        return comment.toResponse(author.id)
    }

    /** 댓글 수정은 생성 순서와 카운터를 유지하고 text와 updatedAt만 갱신한다. */
    @Transactional
    fun updateComment(userId: Long, postId: String, commentId: String, req: UpdatePostCommentRequest): PostCommentResponse {
        requireExistingPost(postId)
        val comment = commentRepo.findByIdAndPostId(commentId, postId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        // 숨김 댓글은 작성자에게도 수정 불가(존재를 드러내지 않는 404).
        if (comment.hiddenAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        }
        if (comment.authorUserId == null || comment.authorUserId != userId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the comment author")
        }
        comment.text = normalizeCommentText(req.text)
        comment.updatedAt = Instant.now(clock)
        return comment.toResponse(userId)
    }

    /**
     * 댓글 삭제. 게시글 row 를 먼저 잠가 댓글 작성·삭제와 게시글 삭제의 잠금 순서를 통일한다.
     * URL 의 게시글과 댓글 관계를 소유권보다 먼저 검증해 다른 게시글의 권한 정보를 노출하지 않는다.
     */
    @Transactional
    fun deleteComment(userId: Long, postId: String, commentId: String) {
        val post = repo.findByIdForUpdate(postId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        if (post.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        }
        val comment = commentRepo.findById(commentId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        }
        if (comment.postId != postId || comment.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        }
        if (comment.authorUserId == null || comment.authorUserId != userId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the comment author")
        }
        // soft delete: row 는 남기고 deletedAt/hiddenAt 을 마킹한다(신고 대상 보존).
        // 최상위 댓글 삭제 시 답글도 함께 삭제 처리한다. 숨김 상태였던 건 카운터가 이미 감소했으므로 제외.
        val replies = if (comment.parentId == null) {
            commentRepo.findByParentId(comment.id).filter { it.deletedAt == null }
        } else {
            emptyList()
        }
        val targets = replies + comment
        val visibleRemoved = targets.count { it.hiddenAt == null }
        val now = Instant.now(clock)
        targets.forEach {
            it.deletedAt = now
            if (it.hiddenAt == null) it.hiddenAt = now
        }
        post.comments = maxOf(0, post.comments - visibleRemoved)
    }

    /** 게시글 존재 확인. 삭제(soft delete)된 게시글은 존재하지 않는 것으로 취급한다. */
    private fun requireExistingPost(postId: String) {
        val post = repo.findById(postId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        }
        if (post.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        }
    }

    /** 공개 조회 경로에서 게시글 존재·노출 여부 확인. 숨김 게시글은 작성자에게만 보이고, 삭제는 모두에게 404. */
    private fun requireViewablePost(postId: String, currentUserId: Long?) {
        val post = repo.findById(postId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        }
        if (post.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        }
        if (post.hiddenAt != null && (post.authorUserId == null || post.authorUserId != currentUserId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        }
    }

    private companion object {
        const val MAX_COMMENT_PAGE_SIZE = 100
    }
}

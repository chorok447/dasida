package com.dasida.api.post

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
 * 게시글 댓글 도메인 서비스. 댓글 목록/pagination/딥링크 위치 조회와 작성/수정/삭제 정책을 담당한다.
 * Controller 에서 옮겨온 validation, 소유권 검증, 동시성 lock, 알림 생성, 트랜잭션을 이 계층에 둔다.
 */
@Service
class PostCommentService(
    private val repo: PostRepository,
    private val commentRepo: PostCommentRepository,
    private val notifications: NotificationService,
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun listComments(postId: String, currentUserId: Long?): List<PostCommentResponse> {
        if (!repo.existsById(postId)) throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        return commentRepo.findByPostIdOrderBySeqAsc(postId).map { it.toResponse(currentUserId) }
    }

    /** 기존 배열 API는 유지하고 상세 화면용 최신순 pagination을 별도 경로로 제공한다. */
    @Transactional(readOnly = true)
    fun listCommentsPage(postId: String, currentUserId: Long?, page: Int, size: Int): PostCommentsPageResponse {
        checkPageParams(page, size, MAX_COMMENT_PAGE_SIZE)
        if (!repo.existsById(postId)) throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")

        val result = commentRepo.findByPostId(
            postId,
            PageRequest.of(
                page,
                size,
                Sort.by(Sort.Order.desc("seq"), Sort.Order.asc("id")),
            ),
        )
        return PostCommentsPageResponse(
            content = result.content.map { it.toResponse(currentUserId) },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    /** 최신순 댓글 pagination과 같은 정렬 기준으로 대상 댓글이 속한 page를 계산한다. */
    @Transactional(readOnly = true)
    fun getCommentPageLocation(postId: String, commentId: String, size: Int): CommentPageLocationResponse {
        checkPageSize(size, MAX_COMMENT_PAGE_SIZE)
        if (!repo.existsById(postId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        }
        val target = commentRepo.findByIdAndPostId(commentId, postId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        val commentsBefore = commentRepo.countBeforeInNewestOrder(postId, target.seq, target.id)
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
        val text = normalizeCommentText(req.text)
        val comment = commentRepo.save(
            PostComment(
                id = "pc-${UUID.randomUUID()}",
                postId = postId,
                author = Author(author.name, author.verified),
                text = text,
                time = "방금 전",
                seq = System.currentTimeMillis(),
                authorUserId = author.id,
            ),
        )
        post.comments += 1
        // 내 게시글에 타인이 댓글 → 게시글 작성자에게 알림(본인 댓글/작성자 미상은 helper 가 생략).
        notifications.notify(
            recipientUserId = post.authorUserId,
            actorUserId = author.id,
            type = NotificationType.POST_COMMENT_CREATED,
            title = "${author.name}님이 내 게시글에 댓글을 남겼습니다",
            body = text,
            href = "/posts/$postId?commentId=${comment.id}",
        )
        return comment.toResponse(author.id)
    }

    /** 댓글 수정은 생성 순서와 카운터를 유지하고 text와 updatedAt만 갱신한다. */
    @Transactional
    fun updateComment(userId: Long, postId: String, commentId: String, req: UpdatePostCommentRequest): PostCommentResponse {
        if (!repo.existsById(postId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        }
        val comment = commentRepo.findByIdAndPostId(commentId, postId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
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
        val comment = commentRepo.findById(commentId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        }
        if (comment.postId != postId) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        }
        if (comment.authorUserId == null || comment.authorUserId != userId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the comment author")
        }
        commentRepo.delete(comment)
        post.comments = maxOf(0, post.comments - 1)
    }

    private companion object {
        const val MAX_COMMENT_PAGE_SIZE = 100
    }
}

package com.dasida.api.post

import com.dasida.api.common.CommentPageLocationResponse
import com.dasida.api.security.AuthUser
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
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

/** HTTP adapter. 인증 사용자 추출 후 Service 위임과 status code 반환만 담당한다. */
@RestController
@RequestMapping("/api/posts")
@Tag(name = "Posts", description = "게시글 및 게시글 댓글 API")
class PostController(
    private val postService: PostService,
    private val postCommentService: PostCommentService,
) {
    @Operation(summary = "게시글 목록 조회", description = "공개 API. JWT 가 있으면 사용자별 좋아요/북마크/소유 상태를 포함한다.")
    @GetMapping
    fun list(@AuthenticationPrincipal user: AuthUser?): List<PostResponse> =
        postService.listPosts(user?.id)

    @Operation(summary = "게시글 검색", description = "공개 API. JWT 가 있으면 사용자별 상태를 포함한다.")
    @GetMapping("/search")
    fun search(
        @RequestParam(name = "q", required = false) q: String?,
        @RequestParam(defaultValue = "false") campaignOnly: Boolean,
        @RequestParam(defaultValue = "latest") sort: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "10") size: Int,
        @AuthenticationPrincipal user: AuthUser?,
    ): PostSearchResponse = postService.searchPosts(user?.id, q, campaignOnly, sort, page, size)

    @Operation(summary = "내 북마크 조회")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/bookmarks")
    fun bookmarks(@AuthenticationPrincipal user: AuthUser): List<PostResponse> =
        postService.getMyBookmarks(user.id)

    @Operation(summary = "내 게시글 조회")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/mine")
    fun mine(@AuthenticationPrincipal user: AuthUser): List<PostResponse> =
        postService.getMyPosts(user.id)

    @Operation(summary = "내 게시글 조회(pagination)")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/mine/page")
    fun minePage(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "10") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): PostPageResponse = postService.getMyPostsPage(user.id, page, size)

    @Operation(summary = "내 북마크 조회(pagination)")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/bookmarks/page")
    fun bookmarksPage(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "10") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): PostPageResponse = postService.getMyBookmarksPage(user.id, page, size)

    @Operation(summary = "게시글 상세 조회", description = "공개 API. JWT 가 있으면 사용자별 상태를 포함한다.")
    @GetMapping("/{id}")
    fun get(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser?): PostResponse =
        postService.getPost(id, user?.id)

    @Operation(summary = "좋아요")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/{id}/like")
    fun like(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): PostResponse =
        postService.likePost(user.id, id)

    @Operation(summary = "좋아요 취소")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{id}/like")
    fun unlike(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): PostResponse =
        postService.unlikePost(user.id, id)

    @Operation(summary = "북마크")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/{id}/bookmark")
    fun bookmark(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): PostResponse =
        postService.bookmarkPost(user.id, id)

    @Operation(summary = "북마크 취소")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{id}/bookmark")
    fun unbookmark(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): PostResponse =
        postService.unbookmarkPost(user.id, id)

    @Operation(summary = "게시글 작성")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@RequestBody req: CreatePostRequest, @AuthenticationPrincipal user: AuthUser): PostResponse =
        postService.createPost(user, req)

    @Operation(summary = "게시글 수정")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/{id}")
    fun update(
        @PathVariable id: String,
        @RequestBody req: UpdatePostRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): PostResponse = postService.updatePost(user.id, id, req)

    @Operation(summary = "게시글 삭제")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser) =
        postService.deletePost(user.id, id)

    @Operation(summary = "게시글 댓글 조회", description = "공개 API. JWT 가 있으면 댓글 소유 여부를 포함한다.")
    @GetMapping("/{id}/comments")
    fun comments(
        @PathVariable id: String,
        @AuthenticationPrincipal user: AuthUser?,
    ): List<PostCommentResponse> = postCommentService.listComments(id, user?.id)

    @Operation(summary = "게시글 댓글 조회(pagination)", description = "공개 API. JWT 가 있으면 댓글 소유 여부를 포함한다.")
    @GetMapping("/{id}/comments/page")
    fun commentsPage(
        @PathVariable id: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @AuthenticationPrincipal user: AuthUser?,
    ): PostCommentsPageResponse = postCommentService.listCommentsPage(id, user?.id, page, size)

    @Operation(summary = "게시글 댓글 위치 조회", description = "특정 댓글이 최신순 pagination 상 몇 번째 page 에 있는지 계산한다.")
    @GetMapping("/{postId}/comments/{commentId}/page")
    fun commentPageLocation(
        @PathVariable postId: String,
        @PathVariable commentId: String,
        @RequestParam(defaultValue = "20") size: Int,
    ): CommentPageLocationResponse = postCommentService.getCommentPageLocation(postId, commentId, size)

    @Operation(summary = "게시글 댓글 작성")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    fun addComment(
        @PathVariable id: String,
        @RequestBody req: CreateCommentRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): PostCommentResponse = postCommentService.createComment(id, user, req)

    @Operation(summary = "게시글 댓글 수정")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/{postId}/comments/{commentId}")
    fun updateComment(
        @PathVariable postId: String,
        @PathVariable commentId: String,
        @RequestBody req: UpdatePostCommentRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): PostCommentResponse = postCommentService.updateComment(user.id, postId, commentId, req)

    @Operation(summary = "게시글 댓글 삭제")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{postId}/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteComment(
        @PathVariable postId: String,
        @PathVariable commentId: String,
        @AuthenticationPrincipal user: AuthUser,
    ) = postCommentService.deleteComment(user.id, postId, commentId)
}

package com.dasida.api.post

import com.dasida.api.common.CommentPageLocationResponse
import com.dasida.api.security.AuthUser
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
class PostController(
    private val postService: PostService,
    private val postCommentService: PostCommentService,
) {
    @GetMapping
    fun list(@AuthenticationPrincipal user: AuthUser?): List<PostResponse> =
        postService.listPosts(user?.id)

    @GetMapping("/search")
    fun search(
        @RequestParam(name = "q", required = false) q: String?,
        @RequestParam(defaultValue = "false") campaignOnly: Boolean,
        @RequestParam(defaultValue = "latest") sort: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "10") size: Int,
        @AuthenticationPrincipal user: AuthUser?,
    ): PostSearchResponse = postService.searchPosts(user?.id, q, campaignOnly, sort, page, size)

    @GetMapping("/bookmarks")
    fun bookmarks(@AuthenticationPrincipal user: AuthUser): List<PostResponse> =
        postService.getMyBookmarks(user.id)

    @GetMapping("/mine")
    fun mine(@AuthenticationPrincipal user: AuthUser): List<PostResponse> =
        postService.getMyPosts(user.id)

    @GetMapping("/mine/page")
    fun minePage(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "10") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): PostPageResponse = postService.getMyPostsPage(user.id, page, size)

    @GetMapping("/bookmarks/page")
    fun bookmarksPage(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "10") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): PostPageResponse = postService.getMyBookmarksPage(user.id, page, size)

    @GetMapping("/{id}")
    fun get(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser?): PostResponse =
        postService.getPost(id, user?.id)

    @PostMapping("/{id}/like")
    fun like(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): PostResponse =
        postService.likePost(user.id, id)

    @DeleteMapping("/{id}/like")
    fun unlike(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): PostResponse =
        postService.unlikePost(user.id, id)

    @PostMapping("/{id}/bookmark")
    fun bookmark(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): PostResponse =
        postService.bookmarkPost(user.id, id)

    @DeleteMapping("/{id}/bookmark")
    fun unbookmark(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): PostResponse =
        postService.unbookmarkPost(user.id, id)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@RequestBody req: CreatePostRequest, @AuthenticationPrincipal user: AuthUser): PostResponse =
        postService.createPost(user, req)

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: String,
        @RequestBody req: UpdatePostRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): PostResponse = postService.updatePost(user.id, id, req)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser) =
        postService.deletePost(user.id, id)

    @GetMapping("/{id}/comments")
    fun comments(
        @PathVariable id: String,
        @AuthenticationPrincipal user: AuthUser?,
    ): List<PostCommentResponse> = postCommentService.listComments(id, user?.id)

    @GetMapping("/{id}/comments/page")
    fun commentsPage(
        @PathVariable id: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @AuthenticationPrincipal user: AuthUser?,
    ): PostCommentsPageResponse = postCommentService.listCommentsPage(id, user?.id, page, size)

    @GetMapping("/{postId}/comments/{commentId}/page")
    fun commentPageLocation(
        @PathVariable postId: String,
        @PathVariable commentId: String,
        @RequestParam(defaultValue = "20") size: Int,
    ): CommentPageLocationResponse = postCommentService.getCommentPageLocation(postId, commentId, size)

    @PostMapping("/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    fun addComment(
        @PathVariable id: String,
        @RequestBody req: CreateCommentRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): PostCommentResponse = postCommentService.createComment(id, user, req)

    @PutMapping("/{postId}/comments/{commentId}")
    fun updateComment(
        @PathVariable postId: String,
        @PathVariable commentId: String,
        @RequestBody req: UpdatePostCommentRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): PostCommentResponse = postCommentService.updateComment(user.id, postId, commentId, req)

    @DeleteMapping("/{postId}/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteComment(
        @PathVariable postId: String,
        @PathVariable commentId: String,
        @AuthenticationPrincipal user: AuthUser,
    ) = postCommentService.deleteComment(user.id, postId, commentId)
}

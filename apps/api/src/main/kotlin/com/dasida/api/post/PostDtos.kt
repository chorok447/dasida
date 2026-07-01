package com.dasida.api.post

import java.time.Instant

data class CreatePostRequest(
    val text: String,
    val images: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val campaignId: String? = null,
)

data class UpdatePostRequest(
    val text: String,
    val images: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val campaignId: String? = null,
)

data class CreateCommentRequest(val text: String)
data class UpdatePostCommentRequest(val text: String)

/** 댓글 응답. authorUserId 자체는 노출하지 않고 현재 사용자 기준 소유 여부만 제공한다. */
data class PostCommentResponse(
    val id: String,
    val postId: String,
    val author: Author,
    val text: String,
    val time: String,
    val ownedByMe: Boolean,
    val edited: Boolean,
    val updatedAt: Instant?,
)

data class PostCommentsPageResponse(
    val content: List<PostCommentResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

/** 게시글 응답. Post 필드 + 요청 유저 기준 좋아요/북마크/소유 상태. authorUserId 자체는 노출하지 않는다. */
data class PostResponse(
    val id: String,
    val author: Author,
    val time: String,
    val text: String,
    val tags: List<String>,
    val images: List<String>,
    val likes: Int,
    val comments: Int,
    val campaignId: String?,
    val likedByMe: Boolean,
    val bookmarkedByMe: Boolean,
    val ownedByMe: Boolean,
)

data class PostSearchResponse(
    val content: List<PostResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

/** 마이페이지 게시글 목록(내 글/저장됨) pagination 응답. Spring Page 를 직접 노출하지 않는다. */
data class PostPageResponse(
    val content: List<PostResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

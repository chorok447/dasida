package com.dasida.api.post

// viewerId 기준 소유 여부를 한 곳에서 판정한다. authorUserId 가 null(시드/기존 글)이거나
// 비로그인(viewerId=null)이거나 다른 사용자면 false. 이름이 아니라 authorUserId 로만 비교.
fun Post.toResponse(
    viewerId: Long?,
    likedByMe: Boolean = false,
    bookmarkedByMe: Boolean = false,
) = PostResponse(
    id = id, author = author, authorId = authorUserId, time = time, text = text, tags = tags, images = images,
    likes = likes, comments = comments, campaignId = campaignId, likedByMe = likedByMe,
    bookmarkedByMe = bookmarkedByMe,
    ownedByMe = authorUserId != null && authorUserId == viewerId,
    hidden = hiddenAt != null,
    createdAt = createdAt,
    views = viewCount,
)

fun PostComment.toResponse(
    viewerId: Long?,
    replies: List<PostCommentResponse> = emptyList(),
    likes: Long = 0,
    likedByMe: Boolean = false,
) = PostCommentResponse(
    id = id,
    postId = postId,
    author = author,
    text = text,
    time = time,
    ownedByMe = authorUserId != null && authorUserId == viewerId,
    edited = updatedAt != null,
    updatedAt = updatedAt,
    parentId = parentId,
    replies = replies,
    likes = likes,
    likedByMe = likedByMe,
)

package com.dasida.api.post

import com.dasida.api.auth.UserFollowService
import com.dasida.api.auth.UserRepository
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.common.checkPageParams
import com.dasida.api.common.SitemapIdsResponse
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
 * 게시글 도메인 서비스. 게시글 조회/검색/작성/수정/삭제와 좋아요·북마크 정책을 담당한다.
 * Controller 에서 옮겨온 validation, 소유권 판정, N+1 회피용 bulk 조회, 동시성 lock, 트랜잭션을 이 계층에 둔다.
 */
@Service
class PostService(
    private val repo: PostRepository,
    private val campaigns: CampaignRepository,
    private val users: UserRepository,
    private val userFollows: UserFollowService,
    private val likeRepo: PostLikeRepository,
    private val bookmarkRepo: PostBookmarkRepository,
    private val commentRepo: PostCommentRepository,
    private val postSearch: PostSearchRepository,
    private val notifications: NotificationService,
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun listPosts(currentUserId: Long?): List<PostResponse> {
        // 무페이지 레거시 엔드포인트 — 테이블이 커져도 전건 직렬화하지 않도록 최신 N건으로 캡.
        // 웹 피드는 /api/posts/search(페이지네이션)를 쓴다.
        val posts = repo.findByHiddenAtIsNull(
            PageRequest.of(0, MAX_LEGACY_LIST_SIZE, Sort.by(Sort.Direction.DESC, "seq")),
        ).content
        // N+1 회피: 내가 좋아요/북마크한 postId 를 각각 한 번에 조회.
        val likedIds = likedByPage(currentUserId, posts.map { it.id })
        val bookmarkedIds = bookmarkedByPage(currentUserId, posts.map { it.id })
        return posts.map {
            it.toResponse(viewerId = currentUserId, likedByMe = it.id in likedIds, bookmarkedByMe = it.id in bookmarkedIds)
        }
    }

    /** sitemap 전용 id 목록. JSON 본문 없이 id 만 페이지 단위로 반환한다. */
    @Transactional(readOnly = true)
    fun listSitemapIds(page: Int, size: Int): SitemapIdsResponse {
        checkPageParams(page, size, MAX_SITEMAP_PAGE_SIZE)
        val result = repo.findIds(PageRequest.of(page, size))
        return SitemapIdsResponse(
            ids = result.content,
            page = page,
            size = size,
            totalElements = result.totalElements,
            totalPages = totalPages(result.totalElements, size),
        )
    }

    /** 공개 검색. Querydsl content/count와 현재 page 상호작용 bulk 조회를 분리한다. */
    @Transactional(readOnly = true)
    fun searchPosts(
        currentUserId: Long?,
        q: String?,
        tag: String?,
        campaignOnly: Boolean,
        followingOnly: Boolean,
        sort: String,
        page: Int,
        size: Int,
    ): PostSearchResponse {
        checkPageParams(page, size, MAX_SEARCH_PAGE_SIZE)

        if (followingOnly && currentUserId == null) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "login required for following feed")
        }

        val query = q?.trim()?.takeIf { it.isNotEmpty() }
        if (query != null && query.length > MAX_SEARCH_QUERY_LENGTH) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "q must not exceed $MAX_SEARCH_QUERY_LENGTH characters",
            )
        }
        val tagFilter = tag?.trim()?.takeIf { it.isNotEmpty() }
        if (tagFilter != null && tagFilter.length > MAX_SEARCH_QUERY_LENGTH) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "tag must not exceed $MAX_SEARCH_QUERY_LENGTH characters",
            )
        }
        val searchSort = when (sort) {
            "latest" -> PostSearchSort.LATEST
            "popular" -> PostSearchSort.POPULAR
            "discussed" -> PostSearchSort.DISCUSSED
            "views" -> PostSearchSort.VIEWS
            else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid post sort")
        }

        val authorUserIds = if (followingOnly) {
            userFollows.followeeIdsFor(requireNotNull(currentUserId))
        } else {
            null
        }

        val result = postSearch.search(
            PostSearchCondition(
                query = query,
                tag = tagFilter,
                campaignOnly = campaignOnly,
                authorUserIds = authorUserIds,
                sort = searchSort,
                page = page,
                size = size,
            ),
        )
        val postIds = result.content.map { it.id }
        val likedIds = likedByPage(currentUserId, postIds)
        val bookmarkedIds = bookmarkedByPage(currentUserId, postIds)

        return PostSearchResponse(
            content = result.content.map {
                it.toResponse(
                    viewerId = currentUserId,
                    likedByMe = it.id in likedIds,
                    bookmarkedByMe = it.id in bookmarkedIds,
                )
            },
            page = page,
            size = size,
            totalElements = result.totalElements,
            totalPages = totalPages(result.totalElements, size),
        )
    }

    /** 특정 사용자의 공개 게시글 목록. */
    @Transactional(readOnly = true)
    fun getPostsByAuthorPage(authorUserId: Long, viewerId: Long?, page: Int, size: Int): PostPageResponse {
        val author = users.findById(authorUserId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "user not found")
        }
        if (author.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "user not found")
        }
        validatePageParams(page, size)
        val result = repo.findByAuthorUserIdAndHiddenAtIsNull(
            authorUserId,
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "seq").and(Sort.by("id"))),
        )
        val postIds = result.content.map { it.id }
        val likedIds = likedByPage(viewerId, postIds)
        val bookmarkedIds = bookmarkedByPage(viewerId, postIds)
        return PostPageResponse(
            content = result.content.map {
                it.toResponse(viewerId = viewerId, likedByMe = it.id in likedIds, bookmarkedByMe = it.id in bookmarkedIds)
            },
            page = page,
            size = size,
            totalElements = result.totalElements,
            totalPages = totalPages(result.totalElements, size),
        )
    }

    /** 현재 사용자가 저장한 게시글. 북마크/게시글/좋아요를 각각 bulk 조회해 N+1을 피한다. */
    @Transactional(readOnly = true)
    fun getMyBookmarks(userId: Long): List<PostResponse> {
        val postIds = bookmarkRepo.findByUserId(userId).map { it.postId }.distinct()
        if (postIds.isEmpty()) return emptyList()

        val posts = repo.findAllByIdInAndHiddenAtIsNullOrderBySeqDesc(postIds)
        if (posts.isEmpty()) return emptyList()

        val likedIds = likeRepo.findByUserIdAndPostIdIn(userId, posts.map { it.id })
            .map { it.postId }
            .toSet()
        return posts.map {
            it.toResponse(viewerId = userId, likedByMe = it.id in likedIds, bookmarkedByMe = true)
        }
    }

    /** 현재 사용자가 작성한 게시글. 소유권은 author.name 이 아니라 authorUserId 로 판단한다. */
    @Transactional(readOnly = true)
    fun getMyPosts(userId: Long): List<PostResponse> {
        val posts = repo.findByAuthorUserIdAndDeletedAtIsNullOrderBySeqDesc(userId)
        if (posts.isEmpty()) return emptyList()

        val postIds = posts.map { it.id }
        // N+1 회피: 좋아요/북마크를 각각 한 번씩 bulk 조회.
        val likedIds = likeRepo.findByUserIdAndPostIdIn(userId, postIds).map { it.postId }.toSet()
        val bookmarkedIds = bookmarkRepo.findByUserIdAndPostIdIn(userId, postIds).map { it.postId }.toSet()
        return posts.map {
            it.toResponse(viewerId = userId, likedByMe = it.id in likedIds, bookmarkedByMe = it.id in bookmarkedIds)
        }
    }

    /** 내 게시글 pagination. 최신순(seq DESC, id). 현재 page 의 id 만 대상으로 좋아요/북마크 bulk 조회. */
    @Transactional(readOnly = true)
    fun getMyPostsPage(userId: Long, page: Int, size: Int): PostPageResponse {
        validatePageParams(page, size)
        val result = repo.findByAuthorUserIdAndDeletedAtIsNull(
            userId,
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "seq").and(Sort.by("id"))),
        )
        val postIds = result.content.map { it.id }
        val likedIds = likedByPage(userId, postIds)
        val bookmarkedIds = bookmarkedByPage(userId, postIds)
        return PostPageResponse(
            content = result.content.map {
                it.toResponse(viewerId = userId, likedByMe = it.id in likedIds, bookmarkedByMe = it.id in bookmarkedIds)
            },
            page = page,
            size = size,
            totalElements = result.totalElements,
            totalPages = totalPages(result.totalElements, size),
        )
    }

    /**
     * 저장한 게시글 pagination. bookmark row 를 id ASC(deterministic, createdAt 없음)로 page 한 뒤
     * 해당 page 의 postId 만 bulk 조회하고 bookmark page 순서를 보존한다. 삭제된 게시글의 orphan bookmark 는 제외.
     */
    @Transactional(readOnly = true)
    fun getMyBookmarksPage(userId: Long, page: Int, size: Int): PostPageResponse {
        validatePageParams(page, size)
        val bookmarkPage = bookmarkRepo.findByUserId(userId, PageRequest.of(page, size, Sort.by("id").ascending()))
        val postIds = bookmarkPage.content.map { it.postId }
        val postsById = if (postIds.isEmpty()) emptyMap() else repo.findAllById(postIds).associateBy { it.id }
        // bookmark page 순서 보존, orphan·숨김 게시글 제외
        val orderedPosts = postIds.mapNotNull { postsById[it] }.filter { it.hiddenAt == null }
        val likedIds = likedByPage(userId, orderedPosts.map { it.id })
        return PostPageResponse(
            content = orderedPosts.map {
                it.toResponse(viewerId = userId, likedByMe = it.id in likedIds, bookmarkedByMe = true)
            },
            page = page,
            size = size,
            totalElements = bookmarkPage.totalElements,
            totalPages = totalPages(bookmarkPage.totalElements, size),
        )
    }

    /**
     * 내가 댓글 단 게시글 pagination. 최근 댓글 순으로 게시글을 중복 없이 페이지하고,
     * 저장 목록과 같은 규칙으로 순서를 보존하며 삭제·숨김 게시글은 결과에서 제외한다.
     */
    @Transactional(readOnly = true)
    fun getMyCommentedPostsPage(userId: Long, page: Int, size: Int): PostPageResponse {
        validatePageParams(page, size)
        val idPage = commentRepo.findCommentedPostIds(userId, PageRequest.of(page, size))
        val postsById = if (idPage.content.isEmpty()) emptyMap() else repo.findAllById(idPage.content).associateBy { it.id }
        val orderedPosts = idPage.content.mapNotNull { postsById[it] }.filter { it.hiddenAt == null && it.deletedAt == null }
        val likedIds = likedByPage(userId, orderedPosts.map { it.id })
        val bookmarkedIds = bookmarkedByPage(userId, orderedPosts.map { it.id })
        return PostPageResponse(
            content = orderedPosts.map {
                it.toResponse(viewerId = userId, likedByMe = it.id in likedIds, bookmarkedByMe = it.id in bookmarkedIds)
            },
            page = page,
            size = size,
            totalElements = idPage.totalElements,
            totalPages = totalPages(idPage.totalElements, size),
        )
    }

    @Transactional(readOnly = true)
    fun getPost(id: String, currentUserId: Long?): PostResponse {
        val post = visibleDetailOrNotFound(id, currentUserId)
        return post.toResponse(
            viewerId = currentUserId,
            likedByMe = currentUserId != null && likeRepo.existsByPostIdAndUserId(id, currentUserId),
            bookmarkedByMe = currentUserId != null && bookmarkRepo.existsByPostIdAndUserId(id, currentUserId),
        )
    }

    /**
     * 조회수 기록. 상세와 같은 가시성 규칙(삭제·숨김 404)을 따르고, 작성자 본인 조회는 세지 않는다.
     * SSR·목록 렌더에 섞이지 않도록 GET 이 아니라 클라이언트가 상세 진입 시 1회 호출하는 별도 POST 로 받는다.
     */
    @Transactional
    fun recordView(id: String, currentUserId: Long?) {
        val post = visibleDetailOrNotFound(id, currentUserId)
        if (post.authorUserId != null && post.authorUserId == currentUserId) return
        repo.incrementViewCount(id)
    }

    /** 상세 가시성 판정: 삭제 글은 모두 404, 숨김 글은 작성자에게만 보인다(그 외 존재를 드러내지 않는 404). */
    private fun visibleDetailOrNotFound(id: String, currentUserId: Long?): Post {
        val post = repo.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")
        }
        if (post.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")
        }
        if (post.hiddenAt != null && (post.authorUserId == null || post.authorUserId != currentUserId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")
        }
        return post
    }

    /**
     * 좋아요. 이미 누른 경우 idempotent(200, 증가 없음).
     *
     * 동시성: 트랜잭션 안에서 post row 를 가장 먼저 write lock 으로 잡아 게시글별로 요청을 직렬화한다.
     * 서로 다른 유저의 동시 좋아요에서도 likes 증가가 유실되지 않고, 같은 유저 동시 요청은 lock 보유 중
     * existsBy 재확인으로 idempotent 처리된다. unique 제약은 최종 방어선으로 유지(예외 삼키기 없음).
     */
    @Transactional
    fun likePost(userId: Long, postId: String): PostResponse {
        val post = visibleForUpdateOrNotFound(postId)
        if (!likeRepo.existsByPostIdAndUserId(postId, userId)) {
            likeRepo.save(PostLike("plk-${UUID.randomUUID()}", postId, userId))
            post.likes += 1
            repo.save(post)
            val liker = users.findById(userId).orElseThrow {
                ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not found")
            }
            notifications.notify(
                recipientUserId = post.authorUserId,
                actorUserId = userId,
                type = NotificationType.POST_LIKED,
                title = "${liker.name}님이 내 게시글을 좋아합니다",
                body = post.text,
                href = "/posts/$postId",
            )
        }
        return post.toResponse(
            viewerId = userId,
            likedByMe = true,
            bookmarkedByMe = bookmarkRepo.existsByPostIdAndUserId(postId, userId),
        )
    }

    /** 좋아요 취소. 누르지 않은 경우 idempotent(200). likes 는 0 미만으로 내려가지 않음. */
    @Transactional
    fun unlikePost(userId: Long, postId: String): PostResponse {
        // write lock 으로 직렬화 → 서로 다른 유저의 동시 unlike 에서도 감소가 유실되지 않음.
        val post = visibleForUpdateOrNotFound(postId)
        likeRepo.findByPostIdAndUserId(postId, userId)?.let {
            likeRepo.delete(it)
            post.likes = maxOf(0, post.likes - 1)
        }
        return post.toResponse(
            viewerId = userId,
            likedByMe = false,
            bookmarkedByMe = bookmarkRepo.existsByPostIdAndUserId(postId, userId),
        )
    }

    /** 북마크. 이미 저장된 경우에도 idempotent(200). */
    @Transactional
    fun bookmarkPost(userId: Long, postId: String): PostResponse {
        // post row lock 뒤 존재 여부를 재확인해 같은 사용자의 동시 요청을 직렬화한다.
        val post = visibleForUpdateOrNotFound(postId)
        if (!bookmarkRepo.existsByPostIdAndUserId(postId, userId)) {
            bookmarkRepo.save(PostBookmark("pbk-${UUID.randomUUID()}", postId, userId))
        }
        return post.toResponse(
            viewerId = userId,
            likedByMe = likeRepo.existsByPostIdAndUserId(postId, userId),
            bookmarkedByMe = true,
        )
    }

    /** 북마크 취소. 저장되지 않은 경우에도 idempotent(200). */
    @Transactional
    fun unbookmarkPost(userId: Long, postId: String): PostResponse {
        val post = visibleForUpdateOrNotFound(postId)
        bookmarkRepo.findByPostIdAndUserId(postId, userId)?.let(bookmarkRepo::delete)
        return post.toResponse(
            viewerId = userId,
            likedByMe = likeRepo.existsByPostIdAndUserId(postId, userId),
            bookmarkedByMe = false,
        )
    }

    @Transactional
    fun createPost(author: AuthUser, req: CreatePostRequest): PostResponse {
        // @Transactional 로 묶어 normalizeFields 의 campaign write lock 을 게시글 저장 commit 까지 유지한다.
        // 캠페인 삭제와 동시에 실행돼도 둘 중 하나만 통과해 orphan campaignId 가 남지 않는다.
        val fields = normalizeFields(req.text, req.tags, req.images, req.campaignId)
        val profileImageUrl = users.findById(author.id).orElse(null)?.profileImageUrl
        return repo.save(
            Post(
                id = "p-${UUID.randomUUID()}",
                author = Author(author.name, author.verified, profileImageUrl),
                time = "방금 전",
                text = fields.text,
                tags = fields.tags,
                images = fields.images,
                likes = 0,
                comments = 0,
                campaignId = fields.campaignId,
                seq = System.currentTimeMillis(),
                authorUserId = author.id,
                createdAt = Instant.now(clock),
            ),
        ).toResponse(viewerId = author.id, likedByMe = false, bookmarkedByMe = false)
    }

    /**
     * 게시글 수정. 작성자(authorUserId)만 가능. 소유권은 author.name 이 아니라 authorUserId 로 판정.
     * 정렬·소유권 필드(seq/time/likes/comments/authorUserId/id/author)는 건드리지 않아 목록 순서가 유지된다.
     */
    @Transactional
    fun updatePost(userId: Long, postId: String, req: UpdatePostRequest): PostResponse {
        // 상호작용 API 와 같은 잠금 순서로 게시글 row 를 먼저 잠근다.
        val post = repo.findByIdForUpdate(postId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        if (post.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        }
        if (post.authorUserId == null || post.authorUserId != userId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the author")
        }
        val fields = normalizeFields(req.text, req.tags, req.images, req.campaignId)
        post.text = fields.text
        post.tags = fields.tags
        post.images = fields.images
        post.campaignId = fields.campaignId
        return post.toResponse(
            viewerId = userId,
            likedByMe = likeRepo.existsByPostIdAndUserId(postId, userId),
            bookmarkedByMe = bookmarkRepo.existsByPostIdAndUserId(postId, userId),
        )
    }

    /**
     * 게시글 삭제(soft delete). 작성자만 가능. row 를 지우지 않고 deletedAt 을 마킹해
     * 신고 대상 보존·복구 여지를 남긴다. hiddenAt 을 함께 세팅해 공개 노출 제외
     * (목록/검색/sitemap/상호작용 404)를 그대로 재사용하며, 좋아요/북마크/댓글 row 도 남긴다.
     * 삭제된 게시글은 존재하지 않는 것으로 취급한다(다시 삭제하면 404).
     */
    @Transactional
    fun deletePost(userId: Long, postId: String) {
        val post = repo.findByIdForUpdate(postId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        if (post.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        }
        if (post.authorUserId == null || post.authorUserId != userId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the author")
        }
        val now = Instant.now(clock)
        post.deletedAt = now
        if (post.hiddenAt == null) post.hiddenAt = now
    }

    /** 생성·수정 공통 검증/정규화. 결과가 어긋나지 않도록 한 곳에서 처리. */
    private fun normalizeFields(
        text: String,
        tags: List<String>,
        images: List<String>,
        campaignId: String?,
    ): NormalizedFields {
        val (normalizedText, mergedImages) = normalizePostFields(text, images)
        val cid = campaignId?.trim()?.ifBlank { null }
        // 단순 existsById 면 확인과 저장 사이에 캠페인이 삭제돼 orphan campaignId 가 생길 수 있다.
        // write lock 으로 캠페인을 잡아 두면 삭제가 게시글 commit 까지 직렬화돼 orphan 을 막는다.
        // create/update 모두 @Transactional 이라 lock 이 트랜잭션 종료까지 유지된다.
        if (cid != null && campaigns.findByIdForUpdate(cid).let { it == null || it.deletedAt != null }) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "campaign not found")
        }
        return NormalizedFields(normalizedText, normalizeTags(tags), mergedImages, cid)
    }

    private data class NormalizedFields(
        val text: String,
        val tags: List<String>,
        val images: List<String>,
        val campaignId: String?,
    )

    /**
     * 상호작용(좋아요/북마크)용 write lock 조회. 숨김 게시글은 작성자 여부와 무관하게
     * 존재를 드러내지 않는 404 로 차단한다(수정/삭제는 작성자 권한 경로라 별도).
     */
    private fun visibleForUpdateOrNotFound(postId: String): Post {
        val post = repo.findByIdForUpdate(postId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        if (post.hiddenAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        }
        return post
    }

    private fun validatePageParams(page: Int, size: Int) = checkPageParams(page, size, MAX_SEARCH_PAGE_SIZE)

    /** 현재 page 의 postId 만 대상으로 좋아요 bulk 조회. 비로그인/빈 page 면 query 생략. */
    private fun likedByPage(userId: Long?, postIds: List<String>): Set<String> =
        if (userId == null || postIds.isEmpty()) {
            emptySet()
        } else {
            likeRepo.findByUserIdAndPostIdIn(userId, postIds).map { it.postId }.toSet()
        }

    /** 현재 page 의 postId 만 대상으로 북마크 bulk 조회. 비로그인/빈 page 면 query 생략. */
    private fun bookmarkedByPage(userId: Long?, postIds: List<String>): Set<String> =
        if (userId == null || postIds.isEmpty()) {
            emptySet()
        } else {
            bookmarkRepo.findByUserIdAndPostIdIn(userId, postIds).map { it.postId }.toSet()
        }

    private companion object {
        const val MAX_SEARCH_PAGE_SIZE = 50
        // 무페이지 레거시 목록(GET /api/posts·/api/campaigns)의 응답 상한.
        const val MAX_LEGACY_LIST_SIZE = 100
        const val MAX_SEARCH_QUERY_LENGTH = 100
        const val MAX_SITEMAP_PAGE_SIZE = 500

        fun totalPages(totalElements: Long, size: Int): Int =
            if (totalElements == 0L) 0 else ((totalElements - 1) / size + 1).toInt()
    }
}

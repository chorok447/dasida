package com.dasida.api.post

import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.common.CommentPageLocationResponse
import com.dasida.api.common.Photos
import com.dasida.api.notification.NotificationService
import com.dasida.api.notification.NotificationType
import com.dasida.api.security.AuthUser
import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.LockModeType
import jakarta.persistence.Table
import jakarta.persistence.Index
import jakarta.persistence.UniqueConstraint
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
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
import java.util.UUID

@Embeddable
class Author(
    var name: String = "",
    var verified: Boolean = false,
)

@Entity
@Table(
    name = "posts",
    indexes = [
        Index(name = "idx_posts_author_user_id", columnList = "author_user_id"),
        // 캠페인 삭제 시 연결 게시글 존재 확인(existsByCampaignId)을 위한 조회용 인덱스.
        Index(name = "idx_posts_campaign_id", columnList = "campaign_id"),
    ],
)
class Post(
    @Id val id: String,
    @Embedded val author: Author,
    @Column(name = "time_label") val time: String,
    // text/tags/images/campaignId 는 수정 API(PUT)에서 갱신되므로 var. 정렬·소유권 필드(seq/time/authorUserId)는 불변.
    @Column(name = "content", columnDefinition = "TEXT") var text: String,
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "json") var tags: List<String>,
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "json") var images: List<String>,
    var likes: Int,
    var comments: Int,
    var campaignId: String? = null,
    @JsonIgnore var seq: Long = 0, // 정렬용. 시드=인덱스, 생성=epoch millis (최신이 위로)
    // 작성자 소유권 판단용. author.name 은 작성 당시 표시 이름 snapshot 이므로 소유권엔 쓰지 않는다.
    // 시드/기존 게시글은 null(소유자 없음). 이름 기반 backfill 하지 않는다.
    @Column(name = "author_user_id") @JsonIgnore val authorUserId: Long? = null,
)

interface PostRepository : JpaRepository<Post, String> {
    fun findAllByIdInOrderBySeqDesc(ids: Collection<String>): List<Post>

    fun findByAuthorUserIdOrderBySeqDesc(authorUserId: Long): List<Post>

    fun findByAuthorUserId(authorUserId: Long, pageable: Pageable): Page<Post>

    /** 상호작용 동시성 방어용 write lock 조회. like/bookmark/comment 트랜잭션을 게시글별로 직렬화. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Post p where p.id = :id")
    fun findByIdForUpdate(@Param("id") id: String): Post?

    /** 캠페인 삭제 시 연결 게시글 존재 확인용. campaign_id 인덱스를 탄다. */
    fun existsByCampaignId(campaignId: String): Boolean
}

/** 사용자별 좋아요. (post_id, user_id) unique 로 중복 좋아요를 막는다. */
@Entity
@Table(name = "post_likes", uniqueConstraints = [UniqueConstraint(columnNames = ["post_id", "user_id"])])
class PostLike(
    @Id val id: String,
    @Column(name = "post_id") val postId: String,
    @Column(name = "user_id") val userId: Long,
)

interface PostLikeRepository : JpaRepository<PostLike, String> {
    fun existsByPostIdAndUserId(postId: String, userId: Long): Boolean
    fun findByPostIdAndUserId(postId: String, userId: Long): PostLike?
    fun findByUserIdAndPostIdIn(userId: Long, postIds: Collection<String>): List<PostLike>
    fun countByPostId(postId: String): Long

    @Transactional
    fun deleteByPostId(postId: String)
}

/** 사용자별 북마크. (post_id, user_id) unique 로 중복 북마크를 막는다. */
@Entity
@Table(
    name = "post_bookmarks",
    uniqueConstraints = [UniqueConstraint(columnNames = ["post_id", "user_id"])],
    indexes = [Index(name = "idx_post_bookmarks_user_id", columnList = "user_id")],
)
class PostBookmark(
    @Id val id: String,
    @Column(name = "post_id") val postId: String,
    @Column(name = "user_id") val userId: Long,
)

interface PostBookmarkRepository : JpaRepository<PostBookmark, String> {
    fun existsByPostIdAndUserId(postId: String, userId: Long): Boolean
    fun findByPostIdAndUserId(postId: String, userId: Long): PostBookmark?
    fun findByUserId(userId: Long): List<PostBookmark>
    fun findByUserId(userId: Long, pageable: Pageable): Page<PostBookmark>
    fun findByUserIdAndPostIdIn(userId: Long, postIds: Collection<String>): List<PostBookmark>
    fun countByPostId(postId: String): Long

    @Transactional
    fun deleteByPostId(postId: String)
}

/** 게시글 댓글. 오래된 순(seq ASC) 정렬. */
@Entity
@Table(name = "post_comments")
class PostComment(
    @Id val id: String,
    @Column(name = "post_id") val postId: String,
    @Embedded val author: Author,
    @Column(columnDefinition = "TEXT") val text: String,
    @Column(name = "time_label") val time: String,
    @JsonIgnore var seq: Long = 0,
    // 권한 판정용. author.name 은 작성 시점의 표시 이름 snapshot 이므로 사용하지 않는다.
    // 기존 댓글은 null 을 허용하며 이름 기반으로 소유권을 복구하지 않는다.
    @Column(name = "author_user_id")
    @JsonIgnore
    val authorUserId: Long? = null,
)

interface PostCommentRepository : JpaRepository<PostComment, String> {
    fun findByPostIdOrderBySeqAsc(postId: String): List<PostComment>
    fun findByPostId(postId: String, pageable: Pageable): Page<PostComment>
    fun findByIdAndPostId(id: String, postId: String): PostComment?

    @Query(
        """
        select count(c) from PostComment c
        where c.postId = :postId
          and (c.seq > :seq or (c.seq = :seq and c.id < :id))
        """,
    )
    fun countBeforeInNewestOrder(
        @Param("postId") postId: String,
        @Param("seq") seq: Long,
        @Param("id") id: String,
    ): Long

    fun countByPostId(postId: String): Long

    @Transactional
    fun deleteByPostId(postId: String)
}

/**
 * 초기 적재 시드. apps/web/src/data/posts.ts 와 1:1 미러. SeedRunner 가 비어있을 때만 저장.
 */
object PostSeed {
    private val workshop = Photos.workshop
    private val nature = Photos.nature
    private val fashion = Photos.fashion
    private val market = Photos.market
    private val people = Photos.people
    private val obj = Photos.obj

    val posts: List<Post> = listOf(
        Post("p1", Author("김다시", true), "2시간 전",
            "낡은 청바지 두 벌로 토트백 한 개. 박음질 시간은 두 시간, 만족감은 일주일.",
            listOf("#청바지업사이클", "#손바느질"), listOf(fashion[0], fashion[2]), 142, 18, "c1"),
        Post("p2", Author("초록도시", false), "5시간 전",
            "오늘은 옥상 텃밭에 토마토를 옮겨 심었어요. 페트병 화분이 의외로 잘 자랍니다.",
            listOf("#도시텃밭", "#페트병"), listOf(nature[1], nature[4]), 89, 7),
        Post("p3", Author("보틀앤캔들", true), "어제",
            "버려진 와인병에 향을 담아 캔들로. 다음 주 공방 클래스 모집 시작합니다.",
            listOf("#캔들", "#유리병", "#클래스"), listOf(obj[0], obj[3]), 256, 32, "c7"),
        Post("p4", Author("한강러너스", true), "2일 전",
            "토요일 플로깅 후기. 두 시간 동안 40L 쓰레기 봉투 6개. 함께 뛴 분들 감사합니다 🌱",
            listOf("#플로깅", "#한강"), listOf(people[0]), 410, 56, "c2"),
        Post("p5", Author("리메이크목공방", false), "3일 전",
            "버려진 책상 상판으로 작은 의자 두 개. 결을 살리는 데에 사흘.",
            listOf("#목공", "#가구업사이클"), listOf(workshop[2], workshop[5]), 178, 14, "c8"),
        Post("p6", Author("리룸", true), "4일 전",
            "지난 마켓에서 모인 옷 312벌. 다음 마켓은 8월 둘째 주, 자세한 일정 곧 공유드릴게요.",
            listOf("#기증마켓", "#리룸"), listOf(market[1], market[4]), 134, 9),
        Post("p7", Author("이연두", false), "5일 전",
            "엄마 옷장에서 꺼낸 80년대 셔츠를 크롭으로 줄였습니다. 30년 묵은 핏이 의외로 멋져요.",
            listOf("#리폼", "#빈티지"), listOf(fashion[5], fashion[6]), 92, 11),
        Post("p8", Author("원두모음", false), "1주 전",
            "커피박 비누 만들기 기록. 카페에서 받은 찌꺼기로 30개 비누 완성.",
            listOf("#커피박", "#비누"), listOf(obj[1], obj[4]), 201, 22, "c6"),
        Post("p9", Author("서울도시농부", false), "1주 전",
            "버려진 우유팩으로 모종 트레이를 만들어 봤어요. 봄에 옮길 모종 100개 준비 완료.",
            listOf("#도시농부", "#우유팩"), listOf(nature[2]), 64, 5),
        Post("p10", Author("다시다시", true), "2주 전",
            "댕댕이 교복 캠페인 작업 중간 점검. 39명이 함께 만들고 있습니다.",
            listOf("#댕교복", "#함께만들기"), listOf(people[3], people[5]), 320, 41, "c1"),
    )
}

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

/** 댓글 응답. authorUserId 자체는 노출하지 않고 현재 사용자 기준 소유 여부만 제공한다. */
data class PostCommentResponse(
    val id: String,
    val postId: String,
    val author: Author,
    val text: String,
    val time: String,
    val ownedByMe: Boolean,
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

@RestController
@RequestMapping("/api/posts")
class PostController(
    private val repo: PostRepository,
    private val campaigns: CampaignRepository,
    private val likeRepo: PostLikeRepository,
    private val bookmarkRepo: PostBookmarkRepository,
    private val commentRepo: PostCommentRepository,
    private val postSearch: PostSearchRepository,
    private val notifications: NotificationService,
) {
    @GetMapping
    fun list(@AuthenticationPrincipal user: AuthUser?): List<PostResponse> {
        val posts = repo.findAll(Sort.by(Sort.Direction.DESC, "seq"))
        // N+1 회피: 내가 좋아요한 postId 를 한 번에 조회.
        val likedIds = if (user == null || posts.isEmpty()) {
            emptySet()
        } else {
            likeRepo.findByUserIdAndPostIdIn(user.id, posts.map { it.id }).map { it.postId }.toSet()
        }
        // N+1 회피: 내가 북마크한 postId 도 한 번에 조회.
        val bookmarkedIds = if (user == null || posts.isEmpty()) {
            emptySet()
        } else {
            bookmarkRepo.findByUserIdAndPostIdIn(user.id, posts.map { it.id }).map { it.postId }.toSet()
        }
        return posts.map {
            it.toResponse(viewerId = user?.id, likedByMe = it.id in likedIds, bookmarkedByMe = it.id in bookmarkedIds)
        }
    }

    /** 공개 검색. Querydsl content/count와 현재 page 상호작용 bulk 조회를 분리한다. */
    @GetMapping("/search")
    @Transactional(readOnly = true)
    fun search(
        @RequestParam(name = "q", required = false) q: String?,
        @RequestParam(defaultValue = "false") campaignOnly: Boolean,
        @RequestParam(defaultValue = "latest") sort: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "10") size: Int,
        @AuthenticationPrincipal user: AuthUser?,
    ): PostSearchResponse {
        if (page < 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "page must not be negative")
        if (size !in 1..MAX_SEARCH_PAGE_SIZE) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be between 1 and $MAX_SEARCH_PAGE_SIZE")
        }

        val query = q?.trim()?.takeIf { it.isNotEmpty() }
        if (query != null && query.length > MAX_SEARCH_QUERY_LENGTH) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "q must not exceed $MAX_SEARCH_QUERY_LENGTH characters",
            )
        }
        val searchSort = when (sort) {
            "latest" -> PostSearchSort.LATEST
            "popular" -> PostSearchSort.POPULAR
            "discussed" -> PostSearchSort.DISCUSSED
            else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid post sort")
        }

        val result = postSearch.search(
            PostSearchCondition(
                query = query,
                campaignOnly = campaignOnly,
                sort = searchSort,
                page = page,
                size = size,
            ),
        )
        val postIds = result.content.map { it.id }
        val likedIds = if (user == null || postIds.isEmpty()) {
            emptySet()
        } else {
            likeRepo.findByUserIdAndPostIdIn(user.id, postIds).map { it.postId }.toSet()
        }
        val bookmarkedIds = if (user == null || postIds.isEmpty()) {
            emptySet()
        } else {
            bookmarkRepo.findByUserIdAndPostIdIn(user.id, postIds).map { it.postId }.toSet()
        }

        return PostSearchResponse(
            content = result.content.map {
                it.toResponse(
                    viewerId = user?.id,
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

    /** 현재 사용자가 저장한 게시글. 북마크/게시글/좋아요를 각각 bulk 조회해 N+1을 피한다. */
    @GetMapping("/bookmarks")
    fun bookmarks(@AuthenticationPrincipal user: AuthUser): List<PostResponse> {
        val postIds = bookmarkRepo.findByUserId(user.id).map { it.postId }.distinct()
        if (postIds.isEmpty()) return emptyList()

        val posts = repo.findAllByIdInOrderBySeqDesc(postIds)
        if (posts.isEmpty()) return emptyList()

        val likedIds = likeRepo.findByUserIdAndPostIdIn(user.id, posts.map { it.id })
            .map { it.postId }
            .toSet()
        return posts.map {
            it.toResponse(viewerId = user.id, likedByMe = it.id in likedIds, bookmarkedByMe = true)
        }
    }

    /** 현재 사용자가 작성한 게시글. 소유권은 author.name 이 아니라 authorUserId 로 판단한다. */
    @GetMapping("/mine")
    fun mine(@AuthenticationPrincipal user: AuthUser): List<PostResponse> {
        val posts = repo.findByAuthorUserIdOrderBySeqDesc(user.id)
        if (posts.isEmpty()) return emptyList()

        val postIds = posts.map { it.id }
        // N+1 회피: 좋아요/북마크를 각각 한 번씩 bulk 조회.
        val likedIds = likeRepo.findByUserIdAndPostIdIn(user.id, postIds).map { it.postId }.toSet()
        val bookmarkedIds = bookmarkRepo.findByUserIdAndPostIdIn(user.id, postIds).map { it.postId }.toSet()
        return posts.map {
            it.toResponse(viewerId = user.id, likedByMe = it.id in likedIds, bookmarkedByMe = it.id in bookmarkedIds)
        }
    }

    /** 내 게시글 pagination. 최신순(seq DESC, id). 현재 page 의 id 만 대상으로 좋아요/북마크 bulk 조회. */
    @GetMapping("/mine/page")
    @Transactional(readOnly = true)
    fun minePage(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "10") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): PostPageResponse {
        validatePageParams(page, size)
        val result = repo.findByAuthorUserId(
            user.id,
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "seq").and(Sort.by("id"))),
        )
        val postIds = result.content.map { it.id }
        val likedIds = likedByPage(user.id, postIds)
        val bookmarkedIds = bookmarkedByPage(user.id, postIds)
        return PostPageResponse(
            content = result.content.map {
                it.toResponse(viewerId = user.id, likedByMe = it.id in likedIds, bookmarkedByMe = it.id in bookmarkedIds)
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
    @GetMapping("/bookmarks/page")
    @Transactional(readOnly = true)
    fun bookmarksPage(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "10") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): PostPageResponse {
        validatePageParams(page, size)
        val bookmarkPage = bookmarkRepo.findByUserId(user.id, PageRequest.of(page, size, Sort.by("id").ascending()))
        val postIds = bookmarkPage.content.map { it.postId }
        val postsById = if (postIds.isEmpty()) emptyMap() else repo.findAllById(postIds).associateBy { it.id }
        val orderedPosts = postIds.mapNotNull { postsById[it] } // bookmark page 순서 보존, orphan 제외
        val likedIds = likedByPage(user.id, orderedPosts.map { it.id })
        return PostPageResponse(
            content = orderedPosts.map {
                it.toResponse(viewerId = user.id, likedByMe = it.id in likedIds, bookmarkedByMe = true)
            },
            page = page,
            size = size,
            totalElements = bookmarkPage.totalElements,
            totalPages = totalPages(bookmarkPage.totalElements, size),
        )
    }

    @GetMapping("/{id}")
    fun get(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser?): PostResponse {
        val post = repo.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")
        }
        return post.toResponse(
            viewerId = user?.id,
            likedByMe = user != null && likeRepo.existsByPostIdAndUserId(id, user.id),
            bookmarkedByMe = user != null && bookmarkRepo.existsByPostIdAndUserId(id, user.id),
        )
    }

    /**
     * 좋아요. 이미 누른 경우 idempotent(200, 증가 없음).
     *
     * 동시성: 트랜잭션 안에서 post row 를 가장 먼저 write lock 으로 잡아 게시글별로 요청을 직렬화한다.
     * 서로 다른 유저의 동시 좋아요에서도 likes 증가가 유실되지 않고, 같은 유저 동시 요청은 lock 보유 중
     * existsBy 재확인으로 idempotent 처리된다. unique 제약은 최종 방어선으로 유지(예외 삼키기 없음).
     */
    @PostMapping("/{id}/like")
    @Transactional
    fun like(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): PostResponse {
        val post = repo.findByIdForUpdate(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")
        if (!likeRepo.existsByPostIdAndUserId(id, user.id)) {
            likeRepo.save(PostLike("plk-${UUID.randomUUID()}", id, user.id))
            post.likes += 1
            repo.save(post)
        }
        return post.toResponse(
            viewerId = user.id,
            likedByMe = true,
            bookmarkedByMe = bookmarkRepo.existsByPostIdAndUserId(id, user.id),
        )
    }

    /** 좋아요 취소. 누르지 않은 경우 idempotent(200). likes 는 0 미만으로 내려가지 않음. */
    @DeleteMapping("/{id}/like")
    @Transactional
    fun unlike(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): PostResponse {
        // write lock 으로 직렬화 → 서로 다른 유저의 동시 unlike 에서도 감소가 유실되지 않음.
        val post = repo.findByIdForUpdate(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")
        likeRepo.findByPostIdAndUserId(id, user.id)?.let {
            likeRepo.delete(it)
            post.likes = maxOf(0, post.likes - 1)
        }
        return post.toResponse(
            viewerId = user.id,
            likedByMe = false,
            bookmarkedByMe = bookmarkRepo.existsByPostIdAndUserId(id, user.id),
        )
    }

    /** 북마크. 이미 저장된 경우에도 idempotent(200). */
    @PostMapping("/{id}/bookmark")
    @Transactional
    fun bookmark(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): PostResponse {
        // post row lock 뒤 존재 여부를 재확인해 같은 사용자의 동시 요청을 직렬화한다.
        val post = repo.findByIdForUpdate(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")
        if (!bookmarkRepo.existsByPostIdAndUserId(id, user.id)) {
            bookmarkRepo.save(PostBookmark("pbk-${UUID.randomUUID()}", id, user.id))
        }
        return post.toResponse(
            viewerId = user.id,
            likedByMe = likeRepo.existsByPostIdAndUserId(id, user.id),
            bookmarkedByMe = true,
        )
    }

    /** 북마크 취소. 저장되지 않은 경우에도 idempotent(200). */
    @DeleteMapping("/{id}/bookmark")
    @Transactional
    fun unbookmark(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): PostResponse {
        val post = repo.findByIdForUpdate(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")
        bookmarkRepo.findByPostIdAndUserId(id, user.id)?.let(bookmarkRepo::delete)
        return post.toResponse(
            viewerId = user.id,
            likedByMe = likeRepo.existsByPostIdAndUserId(id, user.id),
            bookmarkedByMe = false,
        )
    }

    // viewerId 기준 소유 여부를 한 곳에서 판정한다. authorUserId 가 null(시드/기존 글)이거나
    // 비로그인(viewerId=null)이거나 다른 사용자면 false. 이름이 아니라 authorUserId 로만 비교.
    private fun Post.toResponse(
        viewerId: Long?,
        likedByMe: Boolean = false,
        bookmarkedByMe: Boolean = false,
    ) = PostResponse(
        id = id, author = author, time = time, text = text, tags = tags, images = images,
        likes = likes, comments = comments, campaignId = campaignId, likedByMe = likedByMe,
        bookmarkedByMe = bookmarkedByMe,
        ownedByMe = authorUserId != null && authorUserId == viewerId,
    )

    private fun PostComment.toResponse(viewerId: Long?) = PostCommentResponse(
        id = id,
        postId = postId,
        author = author,
        text = text,
        time = time,
        ownedByMe = authorUserId != null && authorUserId == viewerId,
    )

    @GetMapping("/{id}/comments")
    fun comments(
        @PathVariable id: String,
        @AuthenticationPrincipal user: AuthUser?,
    ): List<PostCommentResponse> {
        if (!repo.existsById(id)) throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")
        return commentRepo.findByPostIdOrderBySeqAsc(id).map { it.toResponse(user?.id) }
    }

    /** 기존 배열 API는 유지하고 상세 화면용 최신순 pagination을 별도 경로로 제공한다. */
    @GetMapping("/{id}/comments/page")
    @Transactional(readOnly = true)
    fun commentsPage(
        @PathVariable id: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @AuthenticationPrincipal user: AuthUser?,
    ): PostCommentsPageResponse {
        if (page < 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "page must not be negative")
        if (size !in 1..MAX_COMMENT_PAGE_SIZE) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be between 1 and $MAX_COMMENT_PAGE_SIZE")
        }
        if (!repo.existsById(id)) throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")

        val result = commentRepo.findByPostId(
            id,
            PageRequest.of(
                page,
                size,
                Sort.by(Sort.Order.desc("seq"), Sort.Order.asc("id")),
            ),
        )
        return PostCommentsPageResponse(
            content = result.content.map { it.toResponse(user?.id) },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    /** 최신순 댓글 pagination과 같은 정렬 기준으로 대상 댓글이 속한 page를 계산한다. */
    @GetMapping("/{postId}/comments/{commentId}/page")
    @Transactional(readOnly = true)
    fun commentPageLocation(
        @PathVariable postId: String,
        @PathVariable commentId: String,
        @RequestParam(defaultValue = "20") size: Int,
    ): CommentPageLocationResponse {
        if (size !in 1..MAX_COMMENT_PAGE_SIZE) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be between 1 and $MAX_COMMENT_PAGE_SIZE")
        }
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

    @PostMapping("/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    fun addComment(
        @PathVariable id: String,
        @RequestBody req: CreateCommentRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): PostCommentResponse {
        // write lock 으로 직렬화 → 서로 다른 유저의 동시 댓글 작성에서도 comments 증가가 유실되지 않음.
        val post = repo.findByIdForUpdate(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")
        val text = req.text.trim()
        if (text.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "comment is required")
        if (text.length > MAX_COMMENT_LENGTH) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "comment is too long")
        val comment = commentRepo.save(
            PostComment(
                id = "pc-${UUID.randomUUID()}",
                postId = id,
                author = Author(user.name, user.verified),
                text = text,
                time = "방금 전",
                seq = System.currentTimeMillis(),
                authorUserId = user.id,
            ),
        )
        post.comments += 1
        // 내 게시글에 타인이 댓글 → 게시글 작성자에게 알림(본인 댓글/작성자 미상은 helper 가 생략).
        notifications.notify(
            recipientUserId = post.authorUserId,
            actorUserId = user.id,
            type = NotificationType.POST_COMMENT_CREATED,
            title = "${user.name}님이 내 게시글에 댓글을 남겼습니다",
            body = text,
            href = "/posts/$id?commentId=${comment.id}",
        )
        return comment.toResponse(user.id)
    }

    /**
     * 댓글 삭제. 게시글 row 를 먼저 잠가 댓글 작성·삭제와 게시글 삭제의 잠금 순서를 통일한다.
     * URL 의 게시글과 댓글 관계를 소유권보다 먼저 검증해 다른 게시글의 권한 정보를 노출하지 않는다.
     */
    @DeleteMapping("/{postId}/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    fun deleteComment(
        @PathVariable postId: String,
        @PathVariable commentId: String,
        @AuthenticationPrincipal user: AuthUser,
    ) {
        val post = repo.findByIdForUpdate(postId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $postId not found")
        val comment = commentRepo.findById(commentId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        }
        if (comment.postId != postId) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "comment $commentId not found")
        }
        if (comment.authorUserId == null || comment.authorUserId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the comment author")
        }
        commentRepo.delete(comment)
        post.comments = maxOf(0, post.comments - 1)
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    fun create(@RequestBody req: CreatePostRequest, @AuthenticationPrincipal user: AuthUser): PostResponse {
        // @Transactional 로 묶어 normalizeFields 의 campaign write lock 을 게시글 저장 commit 까지 유지한다.
        // 캠페인 삭제와 동시에 실행돼도 둘 중 하나만 통과해 orphan campaignId 가 남지 않는다.
        val fields = normalizeFields(req.text, req.tags, req.images, req.campaignId)
        return repo.save(
            Post(
                id = "p-${UUID.randomUUID()}",
                author = Author(user.name, user.verified),
                time = "방금 전",
                text = fields.text,
                tags = fields.tags,
                images = fields.images,
                likes = 0,
                comments = 0,
                campaignId = fields.campaignId,
                seq = System.currentTimeMillis(),
                authorUserId = user.id,
            ),
        ).toResponse(viewerId = user.id, likedByMe = false, bookmarkedByMe = false)
    }

    /**
     * 게시글 수정. 작성자(authorUserId)만 가능. 소유권은 author.name 이 아니라 authorUserId 로 판정.
     * 정렬·소유권 필드(seq/time/likes/comments/authorUserId/id/author)는 건드리지 않아 목록 순서가 유지된다.
     */
    @PutMapping("/{id}")
    @Transactional
    fun update(
        @PathVariable id: String,
        @RequestBody req: UpdatePostRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): PostResponse {
        // 상호작용 API 와 같은 잠금 순서로 게시글 row 를 먼저 잠근다.
        val post = repo.findByIdForUpdate(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")
        if (post.authorUserId == null || post.authorUserId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the author")
        }
        val fields = normalizeFields(req.text, req.tags, req.images, req.campaignId)
        post.text = fields.text
        post.tags = fields.tags
        post.images = fields.images
        post.campaignId = fields.campaignId
        return post.toResponse(
            viewerId = user.id,
            likedByMe = likeRepo.existsByPostIdAndUserId(id, user.id),
            bookmarkedByMe = bookmarkRepo.existsByPostIdAndUserId(id, user.id),
        )
    }

    /**
     * 게시글 삭제. 작성자만 가능. 좋아요/북마크/댓글을 먼저 정리한 뒤 게시글을 지운다.
     * soft delete 미도입 → 다시 삭제하면 404. 상호작용 API 와 같은 잠금 순서를 유지한다.
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    fun delete(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser) {
        val post = repo.findByIdForUpdate(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")
        if (post.authorUserId == null || post.authorUserId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the author")
        }
        likeRepo.deleteByPostId(id)
        bookmarkRepo.deleteByPostId(id)
        commentRepo.deleteByPostId(id)
        repo.delete(post)
    }

    /** 생성·수정 공통 검증/정규화. 결과가 어긋나지 않도록 한 곳에서 처리. */
    private fun normalizeFields(
        text: String,
        tags: List<String>,
        images: List<String>,
        campaignId: String?,
    ): NormalizedFields {
        val trimmed = text.trim()
        if (trimmed.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "text is required")
        if (trimmed.length > MAX_TEXT_LENGTH) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "text is too long")
        val cid = campaignId?.trim()?.ifBlank { null }
        // 단순 existsById 면 확인과 저장 사이에 캠페인이 삭제돼 orphan campaignId 가 생길 수 있다.
        // write lock 으로 캠페인을 잡아 두면 삭제가 게시글 commit 까지 직렬화돼 orphan 을 막는다.
        // create/update 모두 @Transactional 이라 lock 이 트랜잭션 종료까지 유지된다.
        if (cid != null && campaigns.findByIdForUpdate(cid) == null) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "campaign not found")
        }
        return NormalizedFields(trimmed, normalizeTags(tags), normalizeImages(images), cid)
    }

    private data class NormalizedFields(
        val text: String,
        val tags: List<String>,
        val images: List<String>,
        val campaignId: String?,
    )

    private fun normalizeTags(tags: List<String>): List<String> {
        val normalized = tags
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .map { if (it.startsWith("#")) it else "#$it" }
            .distinct()
        if (normalized.size > MAX_TAGS) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "too many tags")
        if (normalized.any { it.length > MAX_TAG_LENGTH }) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "tag is too long")
        }
        return normalized
    }

    private fun normalizeImages(images: List<String>): List<String> {
        val normalized = images.map { it.trim() }.filter { it.isNotBlank() }.distinct()
        if (normalized.size > MAX_IMAGES) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "too many images")
        // 서버가 이미지를 fetch 하지 않으므로 SSRF 방어는 범위 밖. http(s) 형식만 최소 검증.
        if (normalized.any { !(it.startsWith("http://") || it.startsWith("https://")) }) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "image must be http(s) url")
        }
        return normalized
    }

    private fun validatePageParams(page: Int, size: Int) {
        if (page < 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "page must not be negative")
        if (size !in 1..MAX_SEARCH_PAGE_SIZE) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be between 1 and $MAX_SEARCH_PAGE_SIZE")
        }
    }

    /** 현재 page 의 postId 만 대상으로 좋아요 bulk 조회. 빈 page 면 query 생략. */
    private fun likedByPage(userId: Long, postIds: List<String>): Set<String> =
        if (postIds.isEmpty()) emptySet() else likeRepo.findByUserIdAndPostIdIn(userId, postIds).map { it.postId }.toSet()

    /** 현재 page 의 postId 만 대상으로 북마크 bulk 조회. 빈 page 면 query 생략. */
    private fun bookmarkedByPage(userId: Long, postIds: List<String>): Set<String> =
        if (postIds.isEmpty()) emptySet() else bookmarkRepo.findByUserIdAndPostIdIn(userId, postIds).map { it.postId }.toSet()

    companion object {
        private const val MAX_TEXT_LENGTH = 1000
        private const val MAX_TAGS = 10
        private const val MAX_TAG_LENGTH = 30
        private const val MAX_IMAGES = 4
        private const val MAX_COMMENT_LENGTH = 500
        private const val MAX_SEARCH_PAGE_SIZE = 50
        private const val MAX_COMMENT_PAGE_SIZE = 100
        private const val MAX_SEARCH_QUERY_LENGTH = 100

        private fun totalPages(totalElements: Long, size: Int): Int =
            if (totalElements == 0L) 0 else ((totalElements - 1) / size + 1).toInt()
    }
}

package com.dasida.api.post

import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.common.Photos
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
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
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
    ],
)
class Post(
    @Id val id: String,
    @Embedded val author: Author,
    @Column(name = "time_label") val time: String,
    @Column(name = "content", columnDefinition = "TEXT") val text: String,
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "json") val tags: List<String>,
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "json") val images: List<String>,
    var likes: Int,
    var comments: Int,
    val campaignId: String? = null,
    @JsonIgnore var seq: Long = 0, // 정렬용. 시드=인덱스, 생성=epoch millis (최신이 위로)
    // 작성자 소유권 판단용. author.name 은 작성 당시 표시 이름 snapshot 이므로 소유권엔 쓰지 않는다.
    // 시드/기존 게시글은 null(소유자 없음). 이름 기반 backfill 하지 않는다.
    @Column(name = "author_user_id") @JsonIgnore val authorUserId: Long? = null,
)

interface PostRepository : JpaRepository<Post, String> {
    fun findAllByIdInOrderBySeqDesc(ids: Collection<String>): List<Post>

    fun findByAuthorUserIdOrderBySeqDesc(authorUserId: Long): List<Post>

    /** 상호작용 동시성 방어용 write lock 조회. like/bookmark/comment 트랜잭션을 게시글별로 직렬화. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Post p where p.id = :id")
    fun findByIdForUpdate(@Param("id") id: String): Post?
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
)

interface PostCommentRepository : JpaRepository<PostComment, String> {
    fun findByPostIdOrderBySeqAsc(postId: String): List<PostComment>
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

data class CreateCommentRequest(val text: String)

/** 게시글 응답. Post 필드 + 요청 유저 기준 좋아요/북마크 상태. */
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
)

@RestController
@RequestMapping("/api/posts")
class PostController(
    private val repo: PostRepository,
    private val campaigns: CampaignRepository,
    private val likeRepo: PostLikeRepository,
    private val bookmarkRepo: PostBookmarkRepository,
    private val commentRepo: PostCommentRepository,
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
            it.toResponse(likedByMe = it.id in likedIds, bookmarkedByMe = it.id in bookmarkedIds)
        }
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
            it.toResponse(likedByMe = it.id in likedIds, bookmarkedByMe = true)
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
            it.toResponse(likedByMe = it.id in likedIds, bookmarkedByMe = it.id in bookmarkedIds)
        }
    }

    @GetMapping("/{id}")
    fun get(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser?): PostResponse {
        val post = repo.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")
        }
        return post.toResponse(
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
            likedByMe = likeRepo.existsByPostIdAndUserId(id, user.id),
            bookmarkedByMe = false,
        )
    }

    private fun Post.toResponse(
        likedByMe: Boolean = false,
        bookmarkedByMe: Boolean = false,
    ) = PostResponse(
        id = id, author = author, time = time, text = text, tags = tags, images = images,
        likes = likes, comments = comments, campaignId = campaignId, likedByMe = likedByMe,
        bookmarkedByMe = bookmarkedByMe,
    )

    @GetMapping("/{id}/comments")
    fun comments(@PathVariable id: String): List<PostComment> {
        if (!repo.existsById(id)) throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")
        return commentRepo.findByPostIdOrderBySeqAsc(id)
    }

    @PostMapping("/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    fun addComment(
        @PathVariable id: String,
        @RequestBody req: CreateCommentRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): PostComment {
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
            ),
        )
        post.comments += 1
        return comment
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@RequestBody req: CreatePostRequest, @AuthenticationPrincipal user: AuthUser): PostResponse {
        val text = req.text.trim()
        if (text.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "text is required")
        if (text.length > MAX_TEXT_LENGTH) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "text is too long")

        val campaignId = req.campaignId?.trim()?.ifBlank { null }
        if (campaignId != null && !campaigns.existsById(campaignId)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "campaign not found")
        }

        return repo.save(
            Post(
                id = "p-${UUID.randomUUID()}",
                author = Author(user.name, user.verified),
                time = "방금 전",
                text = text,
                tags = normalizeTags(req.tags),
                images = normalizeImages(req.images),
                likes = 0,
                comments = 0,
                campaignId = campaignId,
                seq = System.currentTimeMillis(),
                authorUserId = user.id,
            ),
        ).toResponse(likedByMe = false, bookmarkedByMe = false)
    }

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

    companion object {
        private const val MAX_TEXT_LENGTH = 1000
        private const val MAX_TAGS = 10
        private const val MAX_TAG_LENGTH = 30
        private const val MAX_IMAGES = 4
        private const val MAX_COMMENT_LENGTH = 500
    }
}

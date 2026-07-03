package com.dasida.api.post

import com.dasida.api.auth.User
import com.dasida.api.notification.NotificationRepository
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PostControllerTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val jwt: JwtService,
    @param:Autowired val posts: PostRepository,
    @param:Autowired val likeRepo: PostLikeRepository,
    @param:Autowired val bookmarkRepo: PostBookmarkRepository,
    @param:Autowired val commentRepo: PostCommentRepository,
    @param:Autowired val notificationRepo: NotificationRepository,
) {
    private val token = jwt.issue(User(id = 1, email = "t@t.com", passwordHash = "x", name = "테스터", verified = false))
    // 다른 사용자(authorUserId=2) 권한 테스트용 토큰.
    private val token2 = jwt.issue(User(id = 2, email = "u2@t.com", passwordHash = "x", name = "다른이", verified = false))

    // 시드 상태에 의존하지 않도록 테스트용 게시글을 직접 저장.
    private fun savePost(
        likes: Int = 0,
        comments: Int = 0,
        seq: Long = 0,
        authorUserId: Long? = null,
        authorName: String = "작성자",
        text: String = "본문",
        campaignId: String? = null,
    ): String {
        val id = "itp-${UUID.randomUUID()}"
        posts.save(
            Post(
                id, Author(authorName, false), "방금", text, emptyList(), emptyList(), likes, comments,
                campaignId = campaignId, seq = seq, authorUserId = authorUserId,
            ),
        )
        return id
    }

    private fun saveComment(
        postId: String,
        authorUserId: Long? = 1,
        authorName: String = "테스터",
        id: String = "itc-${UUID.randomUUID()}",
        seq: Long = System.currentTimeMillis(),
        text: String = "테스트 댓글",
        updatedAt: Instant? = null,
    ): String {
        commentRepo.saveAndFlush(
            PostComment(
                id = id,
                postId = postId,
                author = Author(authorName, false),
                text = text,
                time = "방금",
                seq = seq,
                authorUserId = authorUserId,
                updatedAt = updatedAt,
            ),
        )
        return id
    }

    private fun updateComment(
        postId: String,
        commentId: String,
        text: String,
        bearer: String? = token,
    ) = mvc.put("/api/posts/$postId/comments/$commentId") {
        if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
        contentType = MediaType.APPLICATION_JSON
        content = """{"text":"$text"}"""
    }

    @Test
    fun `목록은 시드 전체를 반환한다`() {
        mvc.get("/api/posts").andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(PostSeed.posts.size) }
            jsonPath("$[0].id") { value("p1") }
        }
    }

    @Test
    fun `id로 단건을 반환한다`() {
        mvc.get("/api/posts/p1").andExpect {
            status { isOk() }
            jsonPath("$.campaignId") { value("c1") }
        }
    }

    @Test
    fun `없는 id는 404`() {
        mvc.get("/api/posts/nope").andExpect { status { isNotFound() } }
    }

    @Test
    fun `토큰 없이 생성하면 401`() {
        mvc.post("/api/posts") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"무명 글"}"""
        }.andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `깨진 토큰으로 생성하면 401`() {
        mvc.post("/api/posts") {
            headers { add("Authorization", "Bearer broken-token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"무명 글"}"""
        }.andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `토큰으로 생성하면 201과 함께 저장된다`() {
        mvc.post("/api/posts") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"새 업사이클 글","tags":["#테스트"],"images":[]}"""
        }.andExpect {
            status { isCreated() }
            jsonPath("$.id") { exists() }
            jsonPath("$.text") { value("새 업사이클 글") }
            jsonPath("$.author.name") { value("테스터") }
            jsonPath("$.likedByMe") { value(false) }
            jsonPath("$.bookmarkedByMe") { value(false) }
        }
    }

    @Test
    fun `빈 내용은 400`() {
        mvc.post("/api/posts") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"   "}"""
        }.andExpect { status { isBadRequest() } }
    }

    private fun postPost(body: String) = mvc.post("/api/posts") {
        headers { add("Authorization", "Bearer $token") }
        contentType = MediaType.APPLICATION_JSON
        content = body
    }

    @Test
    fun `text 는 trim 되어 저장된다`() {
        postPost("""{"text":"  새 업사이클 글  "}""").andExpect {
            status { isCreated() }
            jsonPath("$.text") { value("새 업사이클 글") }
        }
    }

    @Test
    fun `text 가 너무 길면 400`() {
        val long = "가".repeat(1001)
        postPost("""{"text":"$long"}""").andExpect { status { isBadRequest() } }
    }

    @Test
    fun `tags 는 trim 중복제거 hash prefix 처리되어 저장된다`() {
        postPost("""{"text":"태그","tags":[" 테스트 ","#테스트","업사이클"]}""").andExpect {
            status { isCreated() }
            jsonPath("$.tags.length()") { value(2) }
            jsonPath("$.tags[0]") { value("#테스트") }
            jsonPath("$.tags[1]") { value("#업사이클") }
        }
    }

    @Test
    fun `tags 가 너무 많으면 400`() {
        val many = (1..11).joinToString(",") { "\"#t$it\"" }
        postPost("""{"text":"많음","tags":[$many]}""").andExpect { status { isBadRequest() } }
    }

    @Test
    fun `tag 하나가 너무 길면 400`() {
        val longTag = "#" + "a".repeat(30) // 31자
        postPost("""{"text":"긺","tags":["$longTag"]}""").andExpect { status { isBadRequest() } }
    }

    @Test
    fun `images 는 blank 제거 trim 중복제거되어 저장된다`() {
        postPost(
            """{"text":"이미지","images":[" https://a.com/x ","https://a.com/x","","https://b.com/y"]}""",
        ).andExpect {
            status { isCreated() }
            jsonPath("$.images.length()") { value(2) }
            jsonPath("$.images[0]") { value("https://a.com/x") }
            jsonPath("$.images[1]") { value("https://b.com/y") }
        }
    }

    @Test
    fun `images 가 너무 많으면 400`() {
        val imgs = (1..5).joinToString(",") { "\"https://a.com/$it.png\"" }
        postPost("""{"text":"많음","images":[$imgs]}""").andExpect { status { isBadRequest() } }
    }

    @Test
    fun `image 가 http(s) URL 이 아니면 400`() {
        postPost("""{"text":"형식","images":["ftp://a.com/x.png"]}""").andExpect { status { isBadRequest() } }
    }

    @Test
    fun `존재하는 campaignId 는 201 로 저장된다`() {
        postPost("""{"text":"연결","campaignId":"c1"}""").andExpect {
            status { isCreated() }
            jsonPath("$.campaignId") { value("c1") }
        }
    }

    @Test
    fun `존재하지 않는 campaignId 는 400`() {
        postPost("""{"text":"없음","campaignId":"nope"}""").andExpect { status { isBadRequest() } }
    }

    @Test
    fun `blank campaignId 는 null 로 저장된다`() {
        postPost("""{"text":"공백","campaignId":"  "}""").andExpect {
            status { isCreated() }
            jsonPath("$.campaignId") { value(null) }
        }
    }

    // ---- 좋아요 ----

    @Test
    fun `좋아요는 인증 없으면 401`() {
        mvc.post("/api/posts/${savePost()}/like").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `없는 post 좋아요는 404`() {
        mvc.post("/api/posts/nope/like") { headers { add("Authorization", "Bearer $token") } }
            .andExpect { status { isNotFound() } }
    }

    @Test
    fun `정상 좋아요는 likes 가 1 증가`() {
        val id = savePost(likes = 0)
        mvc.post("/api/posts/$id/like") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$.likes") { value(1) }
            }
    }

    @Test
    fun `같은 유저가 두 번 좋아요해도 중복 증가하지 않는다`() {
        val id = savePost(likes = 0)
        repeat(2) {
            mvc.post("/api/posts/$id/like") { headers { add("Authorization", "Bearer $token") } }
                .andExpect { status { isOk() } }
        }
        mvc.get("/api/posts/$id").andExpect { jsonPath("$.likes") { value(1) } }
    }

    @Test
    fun `좋아요 취소는 likes 를 되돌린다`() {
        val id = savePost(likes = 0)
        mvc.post("/api/posts/$id/like") { headers { add("Authorization", "Bearer $token") } }
        mvc.delete("/api/posts/$id/like") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$.likes") { value(0) }
            }
    }

    @Test
    fun `이미 좋아요 row 가 있으면 like 는 idempotent 하게 200이고 중복 증가하지 않는다`() {
        val id = savePost(likes = 3)
        likeRepo.saveAndFlush(PostLike("plk-pre", id, 1)) // 토큰 유저 id=1 이 이미 좋아요한 상태
        mvc.post("/api/posts/$id/like") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$.likes") { value(3) }
            }
    }

    @Test
    fun `좋아요하지 않은 상태에서 unlike 는 idempotent 하게 200이고 0 유지`() {
        val id = savePost(likes = 0)
        mvc.delete("/api/posts/$id/like") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$.likes") { value(0) }
            }
    }

    @Test
    fun `like row 가 없으면 unlike 는 likes 를 감소시키지 않는다`() {
        val id = savePost(likes = 5)
        mvc.delete("/api/posts/$id/like") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$.likes") { value(5) }
            }
    }

    // ---- likedByMe ----

    @Test
    fun `비로그인 단건은 likedByMe false`() {
        mvc.get("/api/posts/${savePost()}").andExpect {
            status { isOk() }
            jsonPath("$.likedByMe") { value(false) }
        }
    }

    @Test
    fun `내가 좋아요한 post 는 likedByMe true`() {
        val id = savePost()
        likeRepo.saveAndFlush(PostLike("plk-me", id, 1))
        mvc.get("/api/posts/$id") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.likedByMe") { value(true) }
        }
    }

    @Test
    fun `좋아요하지 않은 post 는 로그인해도 likedByMe false`() {
        mvc.get("/api/posts/${savePost()}") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            jsonPath("$.likedByMe") { value(false) }
        }
    }

    @Test
    fun `like 응답은 likedByMe true, unlike 응답은 false`() {
        val id = savePost()
        mvc.post("/api/posts/$id/like") { headers { add("Authorization", "Bearer $token") } }
            .andExpect { jsonPath("$.likedByMe") { value(true) } }
        mvc.delete("/api/posts/$id/like") { headers { add("Authorization", "Bearer $token") } }
            .andExpect { jsonPath("$.likedByMe") { value(false) } }
    }

    @Test
    fun `list 에서 내가 좋아요한 post 만 likedByMe true`() {
        val id = savePost()
        likeRepo.saveAndFlush(PostLike("plk-list", id, 1))
        mvc.get("/api/posts") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$id')].likedByMe") { value(Matchers.hasItem(true)) }
        }
    }

    // ---- 북마크 ----

    @Test
    fun `북마크 추가와 삭제는 인증 없으면 401`() {
        val id = savePost()
        mvc.post("/api/posts/$id/bookmark").andExpect { status { isUnauthorized() } }
        mvc.delete("/api/posts/$id/bookmark").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `없는 post 북마크 추가와 삭제는 404`() {
        mvc.post("/api/posts/nope/bookmark") { headers { add("Authorization", "Bearer $token") } }
            .andExpect { status { isNotFound() } }
        mvc.delete("/api/posts/nope/bookmark") { headers { add("Authorization", "Bearer $token") } }
            .andExpect { status { isNotFound() } }
    }

    @Test
    fun `북마크 POST 응답은 bookmarkedByMe true`() {
        val id = savePost()
        mvc.post("/api/posts/$id/bookmark") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$.bookmarkedByMe") { value(true) }
            }
    }

    @Test
    fun `같은 북마크 POST를 반복해도 row는 하나이고 모두 200`() {
        val id = savePost()
        repeat(2) {
            mvc.post("/api/posts/$id/bookmark") { headers { add("Authorization", "Bearer $token") } }
                .andExpect { status { isOk() } }
        }
        assertThat(bookmarkRepo.countByPostId(id)).isEqualTo(1)
    }

    @Test
    fun `북마크 DELETE 응답은 bookmarkedByMe false`() {
        val id = savePost()
        bookmarkRepo.saveAndFlush(PostBookmark("pbk-delete", id, 1))
        mvc.delete("/api/posts/$id/bookmark") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$.bookmarkedByMe") { value(false) }
            }
        assertThat(bookmarkRepo.countByPostId(id)).isZero()
    }

    @Test
    fun `북마크하지 않은 DELETE도 idempotent 200`() {
        val id = savePost()
        mvc.delete("/api/posts/$id/bookmark") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$.bookmarkedByMe") { value(false) }
            }
    }

    @Test
    fun `비로그인 GET은 bookmarkedByMe false`() {
        val id = savePost()
        mvc.get("/api/posts/$id").andExpect {
            status { isOk() }
            jsonPath("$.bookmarkedByMe") { value(false) }
        }
        mvc.get("/api/posts").andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$id')].bookmarkedByMe") { value(Matchers.hasItem(false)) }
        }
    }

    @Test
    fun `로그인 사용자가 북마크한 단건과 목록은 bookmarkedByMe true`() {
        val id = savePost()
        bookmarkRepo.saveAndFlush(PostBookmark("pbk-get", id, 1))
        mvc.get("/api/posts/$id") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.bookmarkedByMe") { value(true) }
        }
        mvc.get("/api/posts") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$id')].bookmarkedByMe") { value(Matchers.hasItem(true)) }
        }
    }

    @Test
    fun `북마크 응답의 likedByMe는 실제 좋아요 상태와 일치한다`() {
        val id = savePost(likes = 1)
        likeRepo.saveAndFlush(PostLike("plk-bookmark-response", id, 1))
        mvc.post("/api/posts/$id/bookmark") { headers { add("Authorization", "Bearer $token") } }
            .andExpect { jsonPath("$.likedByMe") { value(true) } }
        likeRepo.deleteById("plk-bookmark-response")
        mvc.delete("/api/posts/$id/bookmark") { headers { add("Authorization", "Bearer $token") } }
            .andExpect { jsonPath("$.likedByMe") { value(false) } }
    }

    @Test
    fun `좋아요 응답의 bookmarkedByMe는 실제 북마크 상태와 일치한다`() {
        val id = savePost()
        bookmarkRepo.saveAndFlush(PostBookmark("pbk-like-response", id, 1))
        mvc.post("/api/posts/$id/like") { headers { add("Authorization", "Bearer $token") } }
            .andExpect { jsonPath("$.bookmarkedByMe") { value(true) } }
        mvc.delete("/api/posts/$id/like") { headers { add("Authorization", "Bearer $token") } }
            .andExpect { jsonPath("$.bookmarkedByMe") { value(true) } }
    }

    // ---- 저장한 게시글 목록 ----

    @Test
    fun `비로그인 북마크 목록 요청은 401`() {
        mvc.get("/api/posts/bookmarks").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `북마크가 없으면 빈 배열`() {
        mvc.get("/api/posts/bookmarks") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(0) }
        }
    }

    @Test
    fun `현재 사용자가 북마크한 게시글만 반환한다`() {
        val bookmarkedId = savePost()
        savePost()
        bookmarkRepo.saveAndFlush(PostBookmark("pbk-list-mine", bookmarkedId, 1))

        mvc.get("/api/posts/bookmarks") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(1) }
            jsonPath("$[0].id") { value(bookmarkedId) }
        }
    }

    @Test
    fun `다른 사용자의 북마크는 반환하지 않는다`() {
        val otherUserPostId = savePost()
        bookmarkRepo.saveAndFlush(PostBookmark("pbk-list-other", otherUserPostId, 2))

        mvc.get("/api/posts/bookmarks") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(0) }
        }
    }

    @Test
    fun `북마크 목록은 post seq 내림차순으로 정렬된다`() {
        val oldestId = savePost(seq = 100)
        val newestId = savePost(seq = 300)
        val middleId = savePost(seq = 200)
        bookmarkRepo.saveAllAndFlush(
            listOf(
                PostBookmark("pbk-order-old", oldestId, 1),
                PostBookmark("pbk-order-new", newestId, 1),
                PostBookmark("pbk-order-middle", middleId, 1),
            ),
        )

        mvc.get("/api/posts/bookmarks") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[0].id") { value(newestId) }
            jsonPath("$[1].id") { value(middleId) }
            jsonPath("$[2].id") { value(oldestId) }
        }
    }

    @Test
    fun `북마크 목록의 bookmarkedByMe는 모두 true`() {
        val firstId = savePost()
        val secondId = savePost()
        bookmarkRepo.saveAllAndFlush(
            listOf(
                PostBookmark("pbk-all-true-1", firstId, 1),
                PostBookmark("pbk-all-true-2", secondId, 1),
            ),
        )

        mvc.get("/api/posts/bookmarks") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[*].bookmarkedByMe") { value(Matchers.everyItem(Matchers.equalTo(true))) }
        }
    }

    @Test
    fun `북마크 목록은 좋아요한 게시글만 likedByMe true`() {
        val likedId = savePost(likes = 1)
        val unlikedId = savePost()
        bookmarkRepo.saveAllAndFlush(
            listOf(
                PostBookmark("pbk-liked-1", likedId, 1),
                PostBookmark("pbk-liked-2", unlikedId, 1),
            ),
        )
        likeRepo.saveAndFlush(PostLike("plk-saved-list", likedId, 1))

        mvc.get("/api/posts/bookmarks") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$likedId')].likedByMe") { value(Matchers.hasItem(true)) }
            jsonPath("$[?(@.id == '$unlikedId')].likedByMe") { value(Matchers.hasItem(false)) }
        }
    }

    @Test
    fun `북마크 POST를 반복해도 목록에 게시글은 한 번만 반환된다`() {
        val id = savePost()
        repeat(2) {
            mvc.post("/api/posts/$id/bookmark") { headers { add("Authorization", "Bearer $token") } }
                .andExpect { status { isOk() } }
        }

        mvc.get("/api/posts/bookmarks") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(1) }
            jsonPath("$[0].id") { value(id) }
        }
    }

    // ---- 내 게시글 목록 ----

    @Test
    fun `비로그인 내 게시글 목록 요청은 401`() {
        mvc.get("/api/posts/mine").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `내 게시글이 없으면 빈 배열`() {
        mvc.get("/api/posts/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(0) }
        }
    }

    @Test
    fun `현재 사용자가 작성한 게시글만 반환한다`() {
        val mineId = savePost(authorUserId = 1)
        savePost(authorUserId = 2) // 다른 사용자
        mvc.get("/api/posts/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(1) }
            jsonPath("$[0].id") { value(mineId) }
        }
    }

    @Test
    fun `이름이 같아도 authorUserId가 null이면 내 게시글에서 제외된다`() {
        // 토큰 유저 이름과 동일한 이름의 기존(소유자 없는) 게시글
        savePost(authorUserId = null, authorName = "테스터")
        mvc.get("/api/posts/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(0) }
        }
    }

    @Test
    fun `내 게시글 목록은 seq 내림차순으로 정렬된다`() {
        val oldestId = savePost(seq = 100, authorUserId = 1)
        val newestId = savePost(seq = 300, authorUserId = 1)
        val middleId = savePost(seq = 200, authorUserId = 1)
        mvc.get("/api/posts/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[0].id") { value(newestId) }
            jsonPath("$[1].id") { value(middleId) }
            jsonPath("$[2].id") { value(oldestId) }
        }
    }

    @Test
    fun `내 게시글 목록은 좋아요한 게시글만 likedByMe true`() {
        val likedId = savePost(likes = 1, authorUserId = 1)
        val unlikedId = savePost(authorUserId = 1)
        likeRepo.saveAndFlush(PostLike("plk-mine-list", likedId, 1))
        mvc.get("/api/posts/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$likedId')].likedByMe") { value(Matchers.hasItem(true)) }
            jsonPath("$[?(@.id == '$unlikedId')].likedByMe") { value(Matchers.hasItem(false)) }
        }
    }

    @Test
    fun `내 게시글 목록은 북마크한 게시글만 bookmarkedByMe true`() {
        val bookmarkedId = savePost(authorUserId = 1)
        val plainId = savePost(authorUserId = 1)
        bookmarkRepo.saveAndFlush(PostBookmark("pbk-mine-list", bookmarkedId, 1))
        mvc.get("/api/posts/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$bookmarkedId')].bookmarkedByMe") { value(Matchers.hasItem(true)) }
            jsonPath("$[?(@.id == '$plainId')].bookmarkedByMe") { value(Matchers.hasItem(false)) }
        }
    }

    @Test
    fun `POST로 생성한 게시글은 내 게시글 목록에 나타난다`() {
        val createdId = postPost("""{"text":"내가 쓴 글"}""").andReturn()
            .response.contentAsString.let { Regex("\"id\":\"([^\"]+)\"").find(it)!!.groupValues[1] }
        mvc.get("/api/posts/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$createdId')]") { exists() }
        }
    }

    @Test
    fun `내 게시글 응답에 authorUserId는 노출되지 않는다`() {
        savePost(authorUserId = 1)
        mvc.get("/api/posts/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[0].authorUserId") { doesNotExist() }
        }
    }

    // ---- 댓글 ----

    @Test
    fun `비로그인 댓글 목록은 ownedByMe false`() {
        val id = savePost(comments = 1)
        saveComment(id, authorUserId = 1)
        mvc.get("/api/posts/$id/comments").andExpect {
            status { isOk() }
            jsonPath("$") { isArray() }
            jsonPath("$[0].ownedByMe") { value(false) }
        }
    }

    @Test
    fun `댓글 작성자 로그인 목록은 ownedByMe true`() {
        val id = savePost(comments = 1)
        saveComment(id, authorUserId = 1)
        mvc.get("/api/posts/$id/comments") {
            headers { add("Authorization", "Bearer $token") }
        }.andExpect {
            status { isOk() }
            jsonPath("$[0].ownedByMe") { value(true) }
        }
    }

    @Test
    fun `다른 사용자 댓글 목록은 ownedByMe false`() {
        val id = savePost(comments = 1)
        saveComment(id, authorUserId = 1)
        mvc.get("/api/posts/$id/comments") {
            headers { add("Authorization", "Bearer $token2") }
        }.andExpect {
            status { isOk() }
            jsonPath("$[0].ownedByMe") { value(false) }
        }
    }

    @Test
    fun `authorUserId가 null인 기존 댓글은 ownedByMe false`() {
        val id = savePost(comments = 1)
        saveComment(id, authorUserId = null, authorName = "테스터")
        mvc.get("/api/posts/$id/comments") {
            headers { add("Authorization", "Bearer $token") }
        }.andExpect {
            status { isOk() }
            jsonPath("$[0].ownedByMe") { value(false) }
        }
    }

    @Test
    fun `없는 post 댓글 목록은 404`() {
        mvc.get("/api/posts/nope/comments").andExpect { status { isNotFound() } }
    }

    @Test
    fun `새 댓글 page API는 기본 page 0 size 20과 비로그인 소유 상태를 반환한다`() {
        val postId = savePost(comments = 1)
        val commentId = saveComment(postId, authorUserId = 1)

        mvc.get("/api/posts/$postId/comments/page").andExpect {
            status { isOk() }
            jsonPath("$.page") { value(0) }
            jsonPath("$.size") { value(20) }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.totalPages") { value(1) }
            jsonPath("$.content[0].id") { value(commentId) }
            jsonPath("$.content[0].ownedByMe") { value(false) }
            jsonPath("$.content[0].edited") { value(false) }
            jsonPath("$.content[0].updatedAt") { value(null) }
            jsonPath("$.content[0].authorUserId") { doesNotExist() }
        }
    }

    @Test
    fun `댓글 page API는 로그인 사용자의 댓글만 ownedByMe true`() {
        val postId = savePost(comments = 2)
        val mine = saveComment(postId, authorUserId = 1, seq = 200)
        val other = saveComment(postId, authorUserId = 2, seq = 100)

        mvc.get("/api/posts/$postId/comments/page") {
            headers { add("Authorization", "Bearer $token") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[?(@.id == '$mine')].ownedByMe") { value(Matchers.hasItem(true)) }
            jsonPath("$.content[?(@.id == '$other')].ownedByMe") { value(Matchers.hasItem(false)) }
        }
    }

    @Test
    fun `댓글 page API는 없는 게시글 404와 빈 목록 metadata를 반환한다`() {
        mvc.get("/api/posts/nope/comments/page").andExpect { status { isNotFound() } }

        val postId = savePost()
        mvc.get("/api/posts/$postId/comments/page").andExpect {
            status { isOk() }
            jsonPath("$.content") { isEmpty() }
            jsonPath("$.totalElements") { value(0) }
            jsonPath("$.totalPages") { value(0) }
        }
    }

    @Test
    fun `댓글 page API는 page와 size 범위를 검증한다`() {
        val postId = savePost()
        mvc.get("/api/posts/$postId/comments/page") { param("page", "-1") }
            .andExpect { status { isBadRequest() } }
        mvc.get("/api/posts/$postId/comments/page") { param("size", "0") }
            .andExpect { status { isBadRequest() } }
        mvc.get("/api/posts/$postId/comments/page") { param("size", "101") }
            .andExpect { status { isBadRequest() } }
        mvc.get("/api/posts/$postId/comments/page") { param("size", "100") }
            .andExpect { status { isOk() } }
    }

    @Test
    fun `댓글 page API는 최신 seq와 id tie breaker로 정렬하고 metadata를 유지한다`() {
        val postId = savePost(comments = 4)
        val newest = saveComment(postId, id = "itc-z-${UUID.randomUUID()}", seq = 300)
        val tieA = saveComment(postId, id = "itc-a-${UUID.randomUUID()}", seq = 200)
        val tieB = saveComment(postId, id = "itc-b-${UUID.randomUUID()}", seq = 200)
        val oldest = saveComment(postId, id = "itc-y-${UUID.randomUUID()}", seq = 100)

        mvc.get("/api/posts/$postId/comments/page") {
            param("size", "2")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[*].id") { value(Matchers.contains(newest, tieA)) }
            jsonPath("$.totalElements") { value(4) }
            jsonPath("$.totalPages") { value(2) }
        }
        mvc.get("/api/posts/$postId/comments/page") {
            param("page", "1")
            param("size", "2")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[*].id") { value(Matchers.contains(tieB, oldest)) }
        }
        mvc.get("/api/posts/$postId/comments/page") {
            param("page", "2")
            param("size", "2")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content") { isEmpty() }
            jsonPath("$.totalElements") { value(4) }
            jsonPath("$.totalPages") { value(2) }
        }
    }

    @Test
    fun `댓글 location API는 page 목록과 같은 최신순 및 tie breaker를 사용한다`() {
        val postId = savePost(comments = 4)
        val newest = saveComment(postId, id = "location-new", seq = 300)
        val tieA = saveComment(postId, id = "location-a", seq = 200)
        val tieB = saveComment(postId, id = "location-b", seq = 200)
        val oldest = saveComment(postId, id = "location-old", seq = 100)

        fun expectPage(commentId: String, size: Int, page: Int) {
            mvc.get("/api/posts/$postId/comments/$commentId/page") {
                param("size", size.toString())
            }.andExpect {
                status { isOk() }
                jsonPath("$.commentId") { value(commentId) }
                jsonPath("$.page") { value(page) }
                jsonPath("$.size") { value(size) }
            }
        }

        expectPage(newest, size = 2, page = 0)
        expectPage(tieA, size = 2, page = 0)
        expectPage(tieB, size = 2, page = 1)
        expectPage(oldest, size = 2, page = 1)
        expectPage(tieB, size = 1, page = 2)
    }

    @Test
    fun `댓글 location API는 게시글 관계와 size 및 삭제 상태를 검증한다`() {
        val postId = savePost(comments = 1)
        val otherPostId = savePost(comments = 1)
        val commentId = saveComment(postId)
        val otherCommentId = saveComment(otherPostId)

        mvc.get("/api/posts/missing/comments/$commentId/page")
            .andExpect { status { isNotFound() } }
        mvc.get("/api/posts/$postId/comments/missing/page")
            .andExpect { status { isNotFound() } }
        mvc.get("/api/posts/$postId/comments/$otherCommentId/page")
            .andExpect { status { isNotFound() } }
        mvc.get("/api/posts/$postId/comments/$commentId/page") { param("size", "0") }
            .andExpect { status { isBadRequest() } }
        mvc.get("/api/posts/$postId/comments/$commentId/page") { param("size", "101") }
            .andExpect { status { isBadRequest() } }

        commentRepo.deleteById(commentId)
        commentRepo.flush()
        mvc.get("/api/posts/$postId/comments/$commentId/page")
            .andExpect { status { isNotFound() } }
    }

    @Test
    fun `기존 댓글 배열 API는 오래된 순 배열 계약을 유지한다`() {
        val postId = savePost(comments = 2)
        val oldest = saveComment(postId, seq = 100)
        val newest = saveComment(postId, seq = 200)

        mvc.get("/api/posts/$postId/comments").andExpect {
            status { isOk() }
            jsonPath("$") { isArray() }
            jsonPath("$[*].id") { value(Matchers.contains(oldest, newest)) }
            jsonPath("$[0].edited") { value(false) }
            jsonPath("$[0].updatedAt") { value(null) }
        }
    }

    @Test
    fun `댓글 작성과 삭제는 page API totalElements에 반영된다`() {
        val postId = savePost(comments = 0)
        val created = mvc.post("/api/posts/$postId/comments") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"페이지 댓글"}"""
        }.andExpect {
            status { isCreated() }
            jsonPath("$.ownedByMe") { value(true) }
        }.andReturn().response.contentAsString
        val commentId = Regex("\"id\":\"([^\"]+)\"").find(created)!!.groupValues[1]

        mvc.get("/api/posts/$postId/comments/page").andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].id") { value(commentId) }
        }
        deleteComment(postId, commentId).andExpect { status { isNoContent() } }
        mvc.get("/api/posts/$postId/comments/page").andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(0) }
            jsonPath("$.content") { isEmpty() }
        }
    }

    @Test
    fun `댓글 작성은 인증 없으면 401`() {
        mvc.post("/api/posts/${savePost()}/comments") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"무명 댓글"}"""
        }.andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `blank 댓글은 400`() {
        mvc.post("/api/posts/${savePost()}/comments") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"   "}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `500자 초과 댓글은 400`() {
        val long = "가".repeat(501)
        mvc.post("/api/posts/${savePost()}/comments") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"$long"}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `정상 댓글 작성은 201이고 post comments 가 1 증가`() {
        val id = savePost(comments = 0)
        mvc.post("/api/posts/$id/comments") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"  좋은 글이네요  "}"""
        }.andExpect {
            status { isCreated() }
            jsonPath("$.text") { value("좋은 글이네요") }
            jsonPath("$.author.name") { value("테스터") }
            jsonPath("$.ownedByMe") { value(true) }
            jsonPath("$.edited") { value(false) }
            jsonPath("$.updatedAt") { value(null) }
        }
        mvc.get("/api/posts/$id").andExpect { jsonPath("$.comments") { value(1) } }
    }

    @Test
    fun `댓글 작성 시 사용자 ID가 저장된다`() {
        val id = savePost()
        mvc.post("/api/posts/$id/comments") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"내 댓글"}"""
        }.andExpect { status { isCreated() } }

        assertThat(commentRepo.findByPostIdOrderBySeqAsc(id).single().authorUserId).isEqualTo(1)
    }

    @Test
    fun `댓글 API 응답에 authorUserId는 노출되지 않는다`() {
        val id = savePost()
        mvc.post("/api/posts/$id/comments") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"내 댓글"}"""
        }.andExpect {
            status { isCreated() }
            jsonPath("$.authorUserId") { doesNotExist() }
        }
    }

    @Test
    fun `없는 post 댓글 작성은 404`() {
        mvc.post("/api/posts/nope/comments") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"댓글"}"""
        }.andExpect { status { isNotFound() } }
    }

    @Test
    fun `댓글 작성자는 text만 수정하고 edited 정보를 받는다`() {
        val postId = savePost(comments = 1)
        val commentId = saveComment(postId, seq = 123, text = "원래 댓글")
        val before = commentRepo.findById(commentId).orElseThrow()
        val notificationCount = notificationRepo.count()

        updateComment(postId, commentId, "  수정된 댓글  ").andExpect {
            status { isOk() }
            jsonPath("$.id") { value(commentId) }
            jsonPath("$.postId") { value(postId) }
            jsonPath("$.text") { value("수정된 댓글") }
            jsonPath("$.time") { value("방금") }
            jsonPath("$.ownedByMe") { value(true) }
            jsonPath("$.edited") { value(true) }
            jsonPath("$.updatedAt") { exists() }
            jsonPath("$.authorUserId") { doesNotExist() }
        }
        updateComment(postId, commentId, "수정된 댓글").andExpect { status { isOk() } }

        val saved = commentRepo.findById(commentId).orElseThrow()
        assertThat(saved.text).isEqualTo("수정된 댓글")
        assertThat(saved.updatedAt).isNotNull()
        assertThat(saved.author.name).isEqualTo(before.author.name)
        assertThat(saved.authorUserId).isEqualTo(before.authorUserId)
        assertThat(saved.time).isEqualTo(before.time)
        assertThat(saved.seq).isEqualTo(before.seq)
        assertThat(posts.findById(postId).orElseThrow().comments).isEqualTo(1)
        assertThat(notificationRepo.count()).isEqualTo(notificationCount)
        mvc.get("/api/posts/$postId/comments") {
            headers { add("Authorization", "Bearer $token") }
        }.andExpect {
            status { isOk() }
            jsonPath("$[0].text") { value("수정된 댓글") }
            jsonPath("$[0].edited") { value(true) }
            jsonPath("$[0].updatedAt") { exists() }
        }
        mvc.get("/api/posts/$postId/comments/page") {
            headers { add("Authorization", "Bearer $token") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].text") { value("수정된 댓글") }
            jsonPath("$.content[0].edited") { value(true) }
            jsonPath("$.content[0].updatedAt") { exists() }
        }
        mvc.get("/api/posts/$postId/comments/$commentId/page").andExpect {
            status { isOk() }
            jsonPath("$.page") { value(0) }
        }
    }

    @Test
    fun `댓글 수정은 blank와 500자 초과를 거부하고 기존 내용을 유지한다`() {
        val postId = savePost(comments = 1)
        val commentId = saveComment(postId, text = "원래 댓글")

        updateComment(postId, commentId, "   ").andExpect { status { isBadRequest() } }
        updateComment(postId, commentId, "가".repeat(501)).andExpect { status { isBadRequest() } }

        val saved = commentRepo.findById(commentId).orElseThrow()
        assertThat(saved.text).isEqualTo("원래 댓글")
        assertThat(saved.updatedAt).isNull()
    }

    @Test
    fun `댓글 수정은 인증과 작성자 소유권을 검증한다`() {
        val postId = savePost(comments = 2)
        val mine = saveComment(postId, authorUserId = 1)
        val legacy = saveComment(postId, authorUserId = null)

        updateComment(postId, mine, "수정", bearer = null).andExpect { status { isUnauthorized() } }
        updateComment(postId, mine, "수정", bearer = token2).andExpect { status { isForbidden() } }
        updateComment(postId, legacy, "수정").andExpect { status { isForbidden() } }
        assertThat(commentRepo.findById(mine).orElseThrow().updatedAt).isNull()
        assertThat(commentRepo.findById(legacy).orElseThrow().updatedAt).isNull()
    }

    @Test
    fun `댓글 수정은 게시글과 댓글 관계를 검증한다`() {
        val postId = savePost(comments = 1)
        val otherPostId = savePost(comments = 1)
        val otherCommentId = saveComment(otherPostId)

        updateComment("missing", otherCommentId, "수정").andExpect { status { isNotFound() } }
        updateComment(postId, "missing", "수정").andExpect { status { isNotFound() } }
        updateComment(postId, otherCommentId, "수정").andExpect { status { isNotFound() } }
        assertThat(commentRepo.findById(otherCommentId).orElseThrow().updatedAt).isNull()
    }

    private fun deleteComment(postId: String, commentId: String, bearer: String? = token) =
        mvc.delete("/api/posts/$postId/comments/$commentId") {
            if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
        }

    @Test
    fun `댓글 작성자는 삭제할 수 있고 row와 카운터가 함께 감소한다`() {
        val postId = savePost(comments = 2)
        val commentId = saveComment(postId, authorUserId = 1)

        deleteComment(postId, commentId).andExpect { status { isNoContent() } }

        assertThat(commentRepo.existsById(commentId)).isFalse()
        assertThat(posts.findById(postId).get().comments).isEqualTo(1)
    }

    @Test
    fun `댓글 카운터가 0이면 삭제해도 음수가 되지 않는다`() {
        val postId = savePost(comments = 0)
        val commentId = saveComment(postId, authorUserId = 1)

        deleteComment(postId, commentId).andExpect { status { isNoContent() } }

        assertThat(posts.findById(postId).get().comments).isZero()
    }

    @Test
    fun `비로그인 댓글 삭제는 401`() {
        val postId = savePost(comments = 1)
        val commentId = saveComment(postId, authorUserId = 1)

        deleteComment(postId, commentId, bearer = null).andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `다른 사용자의 댓글 삭제는 403이고 댓글과 카운터가 유지된다`() {
        val postId = savePost(comments = 1)
        val commentId = saveComment(postId, authorUserId = 1)

        deleteComment(postId, commentId, bearer = token2).andExpect { status { isForbidden() } }

        assertThat(commentRepo.existsById(commentId)).isTrue()
        assertThat(posts.findById(postId).get().comments).isEqualTo(1)
    }

    @Test
    fun `authorUserId가 null인 기존 댓글 삭제는 403`() {
        val postId = savePost(comments = 1)
        val commentId = saveComment(postId, authorUserId = null)

        deleteComment(postId, commentId).andExpect { status { isForbidden() } }

        assertThat(commentRepo.existsById(commentId)).isTrue()
        assertThat(posts.findById(postId).get().comments).isEqualTo(1)
    }

    @Test
    fun `존재하지 않는 게시글의 댓글 삭제는 404`() {
        deleteComment("nope", "no-comment").andExpect { status { isNotFound() } }
    }

    @Test
    fun `존재하지 않는 댓글 삭제는 404이고 카운터가 유지된다`() {
        val postId = savePost(comments = 1)

        deleteComment(postId, "no-comment").andExpect { status { isNotFound() } }

        assertThat(posts.findById(postId).get().comments).isEqualTo(1)
    }

    @Test
    fun `다른 게시글의 commentId로 삭제하면 404`() {
        val requestedPostId = savePost(comments = 1)
        val actualPostId = savePost(comments = 1)
        val commentId = saveComment(actualPostId, authorUserId = 1)

        deleteComment(requestedPostId, commentId).andExpect { status { isNotFound() } }

        assertThat(commentRepo.existsById(commentId)).isTrue()
        assertThat(posts.findById(requestedPostId).get().comments).isEqualTo(1)
        assertThat(posts.findById(actualPostId).get().comments).isEqualTo(1)
    }

    @Test
    fun `삭제한 댓글의 반복 삭제와 수정은 404`() {
        val postId = savePost(comments = 1)
        val commentId = saveComment(postId, authorUserId = 1)

        deleteComment(postId, commentId).andExpect { status { isNoContent() } }
        deleteComment(postId, commentId).andExpect { status { isNotFound() } }
        updateComment(postId, commentId, "수정 시도").andExpect { status { isNotFound() } }

        assertThat(posts.findById(postId).get().comments).isZero()
    }

    // ---- ownedByMe ----

    @Test
    fun `비로그인 단건은 ownedByMe false`() {
        val id = savePost(authorUserId = 1)
        mvc.get("/api/posts/$id").andExpect {
            status { isOk() }
            jsonPath("$.ownedByMe") { value(false) }
        }
    }

    @Test
    fun `작성자 로그인 단건은 ownedByMe true`() {
        val id = savePost(authorUserId = 1)
        mvc.get("/api/posts/$id") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.ownedByMe") { value(true) }
        }
    }

    @Test
    fun `다른 사용자 단건은 ownedByMe false`() {
        val id = savePost(authorUserId = 2)
        mvc.get("/api/posts/$id") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.ownedByMe") { value(false) }
        }
    }

    @Test
    fun `authorUserId가 null인 기존 글은 ownedByMe false`() {
        val id = savePost(authorUserId = null, authorName = "테스터")
        mvc.get("/api/posts/$id") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.ownedByMe") { value(false) }
        }
    }

    @Test
    fun `내 게시글 목록은 ownedByMe true`() {
        savePost(authorUserId = 1)
        mvc.get("/api/posts/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[0].ownedByMe") { value(true) }
        }
    }

    @Test
    fun `생성 응답은 ownedByMe true`() {
        postPost("""{"text":"내 글"}""").andExpect {
            status { isCreated() }
            jsonPath("$.ownedByMe") { value(true) }
        }
    }

    // ---- 수정(PUT) ----

    private fun putPost(id: String, body: String, bearer: String? = token) = mvc.put("/api/posts/$id") {
        if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
        contentType = MediaType.APPLICATION_JSON
        content = body
    }

    @Test
    fun `작성자는 게시글을 수정할 수 있다`() {
        val id = savePost(authorUserId = 1)
        putPost(id, """{"text":"수정된 본문","tags":["#수정"],"images":[]}""").andExpect {
            status { isOk() }
            jsonPath("$.text") { value("수정된 본문") }
            jsonPath("$.tags[0]") { value("#수정") }
            jsonPath("$.ownedByMe") { value(true) }
        }
        mvc.get("/api/posts/$id").andExpect { jsonPath("$.text") { value("수정된 본문") } }
    }

    @Test
    fun `수정값은 trim 및 normalize 되어 저장된다`() {
        val id = savePost(authorUserId = 1)
        putPost(id, """{"text":"  공백 본문  ","tags":[" 테스트 ","#테스트","업사이클"],"images":[]}""").andExpect {
            status { isOk() }
            jsonPath("$.text") { value("공백 본문") }
            jsonPath("$.tags.length()") { value(2) }
            jsonPath("$.tags") { value(Matchers.hasItem("#테스트")) }
            jsonPath("$.tags") { value(Matchers.hasItem("#업사이클")) }
        }
    }

    @Test
    fun `비로그인 수정은 401`() {
        val id = savePost(authorUserId = 1)
        putPost(id, """{"text":"x"}""", bearer = null).andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `다른 사용자 수정은 403`() {
        val id = savePost(authorUserId = 1)
        putPost(id, """{"text":"침입"}""", bearer = token2).andExpect { status { isForbidden() } }
    }

    @Test
    fun `authorUserId가 null인 기존 글 수정은 403`() {
        val id = savePost(authorUserId = null, authorName = "테스터")
        putPost(id, """{"text":"x"}""").andExpect { status { isForbidden() } }
    }

    @Test
    fun `없는 게시글 수정은 404`() {
        putPost("nope", """{"text":"x"}""").andExpect { status { isNotFound() } }
    }

    @Test
    fun `빈 내용 수정은 400`() {
        val id = savePost(authorUserId = 1)
        putPost(id, """{"text":"   "}""").andExpect { status { isBadRequest() } }
    }

    @Test
    fun `수정해도 author time likes comments seq는 변경되지 않는다`() {
        val id = savePost(likes = 7, comments = 3, seq = 555, authorUserId = 1, authorName = "원작성자")
        putPost(id, """{"text":"내용만 변경","tags":[],"images":[]}""").andExpect {
            status { isOk() }
            jsonPath("$.author.name") { value("원작성자") }
            jsonPath("$.time") { value("방금") }
            jsonPath("$.likes") { value(7) }
            jsonPath("$.comments") { value(3) }
        }
        // seq 불변 → 정렬 위치 유지. authorUserId 미노출.
        val saved = posts.findById(id).get()
        assertThat(saved.seq).isEqualTo(555)
        assertThat(saved.authorUserId).isEqualTo(1)
    }

    @Test
    fun `수정 응답의 likedByMe와 bookmarkedByMe는 실제 상태를 반영한다`() {
        val id = savePost(authorUserId = 1)
        likeRepo.saveAndFlush(PostLike("plk-upd", id, 1))
        bookmarkRepo.saveAndFlush(PostBookmark("pbk-upd", id, 1))
        putPost(id, """{"text":"갱신"}""").andExpect {
            status { isOk() }
            jsonPath("$.likedByMe") { value(true) }
            jsonPath("$.bookmarkedByMe") { value(true) }
        }
    }

    // ---- 수정 시 campaignId 연결 검증 (캠페인 삭제 경합 방어로 lock 기반 검증) ----

    @Test
    fun `존재하는 campaignId 로 수정하면 200 이고 연결된다`() {
        val id = savePost(authorUserId = 1)
        putPost(id, """{"text":"연결 수정","campaignId":"c1"}""").andExpect {
            status { isOk() }
            jsonPath("$.campaignId") { value("c1") }
        }
        assertThat(posts.findById(id).get().campaignId).isEqualTo("c1")
    }

    @Test
    fun `없는 campaignId 로 수정하면 400 이고 기존 campaignId 와 본문이 유지된다`() {
        val id = savePost(authorUserId = 1, text = "원래 본문", campaignId = "c1")
        putPost(id, """{"text":"바뀌면 안 됨","campaignId":"nope"}""").andExpect { status { isBadRequest() } }
        val saved = posts.findById(id).get()
        assertThat(saved.campaignId).isEqualTo("c1")
        assertThat(saved.text).isEqualTo("원래 본문")
    }

    @Test
    fun `campaignId 가 null 이면 수정은 정상 동작하고 연결이 해제된다`() {
        val id = savePost(authorUserId = 1, campaignId = "c1")
        putPost(id, """{"text":"연결 해제"}""").andExpect {
            status { isOk() }
            jsonPath("$.campaignId") { value(null) }
        }
        assertThat(posts.findById(id).get().campaignId).isNull()
    }

    // ---- 삭제(DELETE) ----

    private fun deletePost(id: String, bearer: String? = token) = mvc.delete("/api/posts/$id") {
        if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
    }

    @Test
    fun `작성자가 삭제하면 204이고 이후 조회는 404`() {
        val id = savePost(authorUserId = 1)
        deletePost(id).andExpect { status { isNoContent() } }
        mvc.get("/api/posts/$id").andExpect { status { isNotFound() } }
    }

    @Test
    fun `삭제하면 좋아요 북마크 댓글 row도 함께 삭제된다`() {
        val id = savePost(authorUserId = 1)
        likeRepo.saveAndFlush(PostLike("plk-del", id, 2))
        bookmarkRepo.saveAndFlush(PostBookmark("pbk-del", id, 2))
        commentRepo.saveAndFlush(PostComment("pc-del", id, Author("누군가", false), "댓글", "방금", 1))
        deletePost(id).andExpect { status { isNoContent() } }
        assertThat(likeRepo.countByPostId(id)).isEqualTo(0)
        assertThat(bookmarkRepo.countByPostId(id)).isEqualTo(0)
        assertThat(commentRepo.countByPostId(id)).isEqualTo(0)
    }

    @Test
    fun `비로그인 삭제는 401`() {
        val id = savePost(authorUserId = 1)
        deletePost(id, bearer = null).andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `다른 사용자 삭제는 403이고 게시글은 유지된다`() {
        val id = savePost(authorUserId = 1)
        deletePost(id, bearer = token2).andExpect { status { isForbidden() } }
        assertThat(posts.existsById(id)).isTrue()
    }

    @Test
    fun `authorUserId가 null인 게시글 삭제는 403`() {
        val id = savePost(authorUserId = null)
        deletePost(id).andExpect { status { isForbidden() } }
        assertThat(posts.existsById(id)).isTrue()
    }

    @Test
    fun `없는 게시글 삭제는 404`() {
        deletePost("nope").andExpect { status { isNotFound() } }
    }

    @Test
    fun `같은 게시글을 다시 삭제하면 404`() {
        val id = savePost(authorUserId = 1)
        deletePost(id).andExpect { status { isNoContent() } }
        deletePost(id).andExpect { status { isNotFound() } }
    }
}

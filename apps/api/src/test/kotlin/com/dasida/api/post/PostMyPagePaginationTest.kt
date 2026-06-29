package com.dasida.api.post

import com.dasida.api.auth.User
import com.dasida.api.security.JwtService
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PostMyPagePaginationTest(
    @Autowired val mvc: MockMvc,
    @Autowired val jwt: JwtService,
    @Autowired val posts: PostRepository,
    @Autowired val likeRepo: PostLikeRepository,
    @Autowired val bookmarkRepo: PostBookmarkRepository,
) {
    private val me = 1L
    private val token = jwt.issue(User(id = me, email = "me@t.com", passwordHash = "x", name = "나", verified = false))

    private fun savePost(seq: Long, authorUserId: Long? = me): String {
        val id = "pg-${UUID.randomUUID()}"
        posts.saveAndFlush(
            Post(id, Author("작성자", false), "방금", "본문", emptyList(), emptyList(), 0, 0, seq = seq, authorUserId = authorUserId),
        )
        return id
    }

    private fun like(postId: String, userId: Long = me) =
        likeRepo.saveAndFlush(PostLike("pl-${UUID.randomUUID()}", postId, userId))

    private fun bookmark(postId: String, userId: Long = me): String {
        val id = "pb-${UUID.randomUUID()}"
        bookmarkRepo.saveAndFlush(PostBookmark(id, postId, userId))
        return id
    }

    // ---- 인증 ----

    @Test
    fun `비로그인은 401`() {
        mvc.get("/api/posts/mine/page").andExpect { status { isUnauthorized() } }
        mvc.get("/api/posts/bookmarks/page").andExpect { status { isUnauthorized() } }
    }

    // ---- page/size ----

    @Test
    fun `page와 size를 검증한다`() {
        for (path in listOf("/api/posts/mine/page", "/api/posts/bookmarks/page")) {
            mvc.get(path) { headers { add("Authorization", "Bearer $token") }; param("page", "-1") }
                .andExpect { status { isBadRequest() } }
            mvc.get(path) { headers { add("Authorization", "Bearer $token") }; param("size", "0") }
                .andExpect { status { isBadRequest() } }
            mvc.get(path) { headers { add("Authorization", "Bearer $token") }; param("size", "51") }
                .andExpect { status { isBadRequest() } }
            mvc.get(path) { headers { add("Authorization", "Bearer $token") } }
                .andExpect { status { isOk() }; jsonPath("$.size") { value(10) } } // 기본 size
        }
    }

    @Test
    fun `범위 밖 page는 빈 content와 정확한 metadata`() {
        savePost(seq = 1)
        mvc.get("/api/posts/mine/page") {
            headers { add("Authorization", "Bearer $token") }
            param("page", "5"); param("size", "10")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(0) }
            jsonPath("$.page") { value(5) }
            jsonPath("$.size") { value(10) }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.totalPages") { value(1) }
        }
    }

    // ---- 내 게시글 ----

    @Test
    fun `내 게시글만 최신순으로 반환하고 상태가 정확하다`() {
        val older = savePost(seq = 1)
        val newer = savePost(seq = 2)
        savePost(seq = 3, authorUserId = 2L) // 다른 사용자 글
        like(newer)
        bookmark(newer)

        mvc.get("/api/posts/mine/page") {
            headers { add("Authorization", "Bearer $token") }
            param("size", "10")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(2) } // 다른 사용자 글 미포함
            jsonPath("$.content[*].id") { value(Matchers.contains(newer, older)) } // 최신순
            jsonPath("$.content[0].ownedByMe") { value(true) }
            jsonPath("$.content[0].likedByMe") { value(true) }
            jsonPath("$.content[0].bookmarkedByMe") { value(true) }
            jsonPath("$.content[1].likedByMe") { value(false) }
            jsonPath("$.content[1].bookmarkedByMe") { value(false) }
        }
    }

    @Test
    fun `내 게시글 page 분할`() {
        repeat(3) { savePost(seq = it.toLong()) }
        mvc.get("/api/posts/mine/page") {
            headers { add("Authorization", "Bearer $token") }
            param("page", "1"); param("size", "2")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(1) }
            jsonPath("$.page") { value(1) }
            jsonPath("$.totalElements") { value(3) }
            jsonPath("$.totalPages") { value(2) }
        }
    }

    @Test
    fun `기존 mine 배열 응답은 유지된다`() {
        savePost(seq = 1)
        mvc.get("/api/posts/mine") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$") { isArray() }
                jsonPath("$.length()") { value(1) }
            }
    }

    // ---- 저장한 게시글 ----

    @Test
    fun `내 북마크만 반환하고 bookmarkedByMe는 true`() {
        val mine1 = savePost(seq = 1, authorUserId = 2L) // 남의 글이어도 내가 북마크하면 포함
        val mine2 = savePost(seq = 2, authorUserId = 2L)
        val notMine = savePost(seq = 3, authorUserId = 2L)
        bookmark(mine1)
        bookmark(mine2)
        bookmark(notMine, userId = 2L) // 다른 사용자 북마크
        like(mine1)

        mvc.get("/api/posts/bookmarks/page") {
            headers { add("Authorization", "Bearer $token") }
            param("size", "10")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(2) }
            jsonPath("$.content[*].bookmarkedByMe") { value(Matchers.everyItem(Matchers.equalTo(true))) }
            jsonPath("$.content[?(@.id == '$mine1')].likedByMe") { value(Matchers.hasItem(true)) }
        }
    }

    @Test
    fun `저장 해제 후 page 결과에서 제외된다`() {
        val id = savePost(seq = 1, authorUserId = 2L)
        val bid = bookmark(id)
        bookmarkRepo.deleteById(bid)

        mvc.get("/api/posts/bookmarks/page") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$.totalElements") { value(0) }
                jsonPath("$.content.length()") { value(0) }
            }
    }

    @Test
    fun `기존 bookmarks 배열 응답은 유지된다`() {
        val id = savePost(seq = 1, authorUserId = 2L)
        bookmark(id)
        mvc.get("/api/posts/bookmarks") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$") { isArray() }
                jsonPath("$.length()") { value(1) }
            }
    }
}

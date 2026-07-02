package com.dasida.api.post

import com.dasida.api.auth.User
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PostSearchControllerTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val postRepo: PostRepository,
    @param:Autowired private val likeRepo: PostLikeRepository,
    @param:Autowired private val bookmarkRepo: PostBookmarkRepository,
) {
    private val token = jwt.issue(
        User(id = 1, email = "post-search@test.com", passwordHash = "x", name = "검색 사용자", verified = true),
    )

    private fun marker(prefix: String = "post-search"): String =
        "$prefix-${UUID.randomUUID().toString().replace("-", "")}"

    private fun savePost(
        id: String = "search-post-${UUID.randomUUID()}",
        text: String = "검색 본문",
        authorName: String = "검색 작성자",
        campaignId: String? = null,
        likes: Int = 0,
        comments: Int = 0,
        seq: Long = System.nanoTime(),
        authorUserId: Long? = null,
    ): String {
        postRepo.saveAndFlush(
            Post(
                id = id,
                author = Author(authorName, false),
                time = "방금",
                text = text,
                tags = emptyList(),
                images = emptyList(),
                likes = likes,
                comments = comments,
                campaignId = campaignId,
                seq = seq,
                authorUserId = authorUserId,
            ),
        )
        return id
    }

    @Test
    fun `기본 검색은 latest page 0 size 10과 metadata를 반환한다`() {
        val newest = savePost(seq = Long.MAX_VALUE)
        val next = savePost(seq = Long.MAX_VALUE - 1)

        mvc.get("/api/posts/search").andExpect {
            status { isOk() }
            jsonPath("$.page") { value(0) }
            jsonPath("$.size") { value(10) }
            jsonPath("$.totalElements") { value(PostSeed.posts.size + 2) }
            jsonPath("$.totalPages") { value(2) }
            jsonPath("$.content.length()") { value(10) }
            jsonPath("$.content[0].id") { value(newest) }
            jsonPath("$.content[1].id") { value(next) }
        }
    }

    @Test
    fun `본문과 작성자 이름을 대소문자 무시 부분 검색한다`() {
        val textKeyword = marker("TextCase")
        val authorKeyword = marker("AuthorCase")
        val textId = savePost(text = "앞 ${textKeyword.uppercase()} 뒤")
        val authorId = savePost(authorName = "앞 ${authorKeyword.uppercase()} 뒤")

        mvc.get("/api/posts/search") { param("q", textKeyword.lowercase()) }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].id") { value(textId) }
        }
        mvc.get("/api/posts/search") { param("q", authorKeyword.lowercase()) }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].id") { value(authorId) }
        }
    }

    @Test
    fun `한글 검색과 trim을 지원하고 빈 검색어는 조건에서 제외한다`() {
        val keyword = "한글게시글${UUID.randomUUID().toString().take(8)}"
        val matched = savePost(text = "업사이클 $keyword 기록")
        val newest = savePost(seq = Long.MAX_VALUE)

        mvc.get("/api/posts/search") { param("q", "  $keyword  ") }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].id") { value(matched) }
        }
        mvc.get("/api/posts/search") {
            param("q", "   ")
            param("size", "1")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].id") { value(newest) }
        }
    }

    @Test
    fun `검색어는 100자를 허용하고 초과하면 400`() {
        mvc.get("/api/posts/search") { param("q", "가".repeat(100)) }
            .andExpect { status { isOk() } }
        mvc.get("/api/posts/search") { param("q", "가".repeat(101)) }
            .andExpect { status { isBadRequest() } }
    }

    @Test
    fun `검색 특수문자는 LIKE wildcard가 아니라 일반 문자로 처리한다`() {
        val prefix = marker("literal")
        val percent = savePost(text = "$prefix%percent")
        val underscore = savePost(text = "${prefix}_underscore")
        val backslash = savePost(text = "$prefix\\backslash")
        savePost(text = "${prefix}Xpercent")
        savePost(text = "${prefix}Xunderscore")

        listOf("$prefix%" to percent, "${prefix}_" to underscore, "$prefix\\" to backslash).forEach { (query, id) ->
            mvc.get("/api/posts/search") { param("q", query) }.andExpect {
                status { isOk() }
                jsonPath("$.totalElements") { value(1) }
                jsonPath("$.content[0].id") { value(id) }
            }
        }
    }

    @Test
    fun `campaignOnly는 캠페인 연결 게시글만 반환한다`() {
        val keyword = marker("campaign")
        val campaignPost = savePost(text = keyword, campaignId = "c1")
        savePost(text = keyword)

        mvc.get("/api/posts/search") {
            param("q", keyword)
            param("campaignOnly", "true")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].id") { value(campaignPost) }
        }
    }

    @Test
    fun `latest popular discussed 정렬은 명시적 tie breaker를 사용한다`() {
        val keyword = marker("sort")
        val latest = savePost(id = "$keyword-z", text = keyword, likes = 1, comments = 1, seq = 300)
        val popular = savePost(id = "$keyword-y", text = keyword, likes = 9, comments = 2, seq = 100)
        val discussed = savePost(id = "$keyword-x", text = keyword, likes = 2, comments = 9, seq = 50)
        val tieA = savePost(id = "$keyword-a", text = keyword, likes = 5, comments = 5, seq = 200)
        val tieB = savePost(id = "$keyword-b", text = keyword, likes = 5, comments = 5, seq = 200)

        mvc.get("/api/posts/search") {
            param("q", keyword)
            param("sort", "latest")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[*].id") { value(Matchers.contains(latest, tieA, tieB, popular, discussed)) }
        }
        mvc.get("/api/posts/search") {
            param("q", keyword)
            param("sort", "popular")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[*].id") { value(Matchers.contains(popular, tieA, tieB, discussed, latest)) }
        }
        mvc.get("/api/posts/search") {
            param("q", keyword)
            param("sort", "discussed")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[*].id") { value(Matchers.contains(discussed, tieA, tieB, popular, latest)) }
        }
    }

    @Test
    fun `잘못된 sort와 page size 범위는 400`() {
        mvc.get("/api/posts/search") { param("sort", "oldest") }
            .andExpect { status { isBadRequest() } }
        mvc.get("/api/posts/search") { param("page", "-1") }
            .andExpect { status { isBadRequest() } }
        mvc.get("/api/posts/search") { param("size", "0") }
            .andExpect { status { isBadRequest() } }
        mvc.get("/api/posts/search") { param("size", "51") }
            .andExpect { status { isBadRequest() } }
        mvc.get("/api/posts/search") { param("size", "1") }
            .andExpect { status { isOk() } }
        mvc.get("/api/posts/search") { param("size", "50") }
            .andExpect { status { isOk() } }
    }

    @Test
    fun `pagination metadata가 정확하고 범위 밖 page는 빈 content`() {
        val keyword = marker("paging")
        repeat(5) { index -> savePost(text = "$keyword $index", seq = index.toLong()) }

        mvc.get("/api/posts/search") {
            param("q", keyword)
            param("page", "1")
            param("size", "2")
        }.andExpect {
            status { isOk() }
            jsonPath("$.page") { value(1) }
            jsonPath("$.size") { value(2) }
            jsonPath("$.totalElements") { value(5) }
            jsonPath("$.totalPages") { value(3) }
            jsonPath("$.content.length()") { value(2) }
        }
        mvc.get("/api/posts/search") {
            param("q", keyword)
            param("page", "3")
            param("size", "2")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(5) }
            jsonPath("$.totalPages") { value(3) }
            jsonPath("$.content.length()") { value(0) }
        }
    }

    @Test
    fun `비로그인 검색은 사용자별 상태가 모두 false`() {
        val keyword = marker("anonymous")
        savePost(text = keyword, authorUserId = 1)

        mvc.get("/api/posts/search") { param("q", keyword) }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].likedByMe") { value(false) }
            jsonPath("$.content[0].bookmarkedByMe") { value(false) }
            jsonPath("$.content[0].ownedByMe") { value(false) }
        }
    }

    @Test
    fun `로그인 검색은 현재 page의 좋아요 북마크 소유 상태를 반영한다`() {
        val keyword = marker("viewer")
        val id = savePost(text = keyword, authorUserId = 1)
        likeRepo.saveAndFlush(PostLike("search-like-${UUID.randomUUID()}", id, 1))
        bookmarkRepo.saveAndFlush(PostBookmark("search-bookmark-${UUID.randomUUID()}", id, 1))

        mvc.get("/api/posts/search") {
            param("q", keyword)
            headers { add("Authorization", "Bearer $token") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].likedByMe") { value(true) }
            jsonPath("$.content[0].bookmarkedByMe") { value(true) }
            jsonPath("$.content[0].ownedByMe") { value(true) }
            jsonPath("$.content[0].authorUserId") { doesNotExist() }
        }
    }

    @Test
    fun `현재 page 밖 상호작용 상태가 현재 page 결과에 섞이지 않는다`() {
        val keyword = marker("page-state")
        val first = savePost(text = keyword, seq = 200)
        val second = savePost(text = keyword, seq = 100)
        likeRepo.saveAndFlush(PostLike("search-like-${UUID.randomUUID()}", second, 1))
        bookmarkRepo.saveAndFlush(PostBookmark("search-bookmark-${UUID.randomUUID()}", second, 1))

        mvc.get("/api/posts/search") {
            param("q", keyword)
            param("size", "1")
            headers { add("Authorization", "Bearer $token") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].id") { value(first) }
            jsonPath("$.content[0].likedByMe") { value(false) }
            jsonPath("$.content[0].bookmarkedByMe") { value(false) }
        }
        mvc.get("/api/posts/search") {
            param("q", keyword)
            param("page", "1")
            param("size", "1")
            headers { add("Authorization", "Bearer $token") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].id") { value(second) }
            jsonPath("$.content[0].likedByMe") { value(true) }
            jsonPath("$.content[0].bookmarkedByMe") { value(true) }
        }
    }

    @Test
    fun `기존 목록 배열 계약을 유지하고 search를 id로 오인하지 않는다`() {
        val arrayResponse = mvc.get("/api/posts").andExpect {
            status { isOk() }
            jsonPath("$") { isArray() }
        }.andReturn().response.contentAsString
        assertThat(arrayResponse).startsWith("[")

        mvc.get("/api/posts/search").andExpect {
            status { isOk() }
            jsonPath("$.content") { isArray() }
            jsonPath("$.page") { value(0) }
        }
    }
}

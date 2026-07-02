package com.dasida.api.reference

import com.dasida.api.auth.User
import com.dasida.api.campaign.Campaign
import com.dasida.api.campaign.CampaignBody
import com.dasida.api.campaign.CampaignComment
import com.dasida.api.campaign.CampaignCommentRepository
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostBookmark
import com.dasida.api.post.PostBookmarkRepository
import com.dasida.api.post.PostComment
import com.dasida.api.post.PostCommentRepository
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.put
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

/**
 * 삭제 연쇄(cascade) 정합성의 API 관찰 가능 동작 회귀 방지.
 *
 * PostControllerTest 는 게시글 삭제 시 like/bookmark/comment **row** 가 사라지는 것을 repository count 로 고정한다.
 * 다만 그 cascade 가 **조회 API 로 관찰되는 결과**(다른 사용자의 북마크 목록에서 제외, 댓글 목록/조작 404)는
 * 고정되지 않았다. 캠페인 댓글도 삭제 시 cascade 되지만 삭제된 캠페인의 댓글 목록이 404 인지는 고정되지 않았다.
 * cascade 나 parent 존재 검증이 리팩터링돼도 dangling 데이터가 조회로 새어나오지 않도록 고정한다.
 * (row-level cascade 카운트는 PostControllerTest, 삭제 리소스 자체의 목록/검색 비노출은 PR #85, 삭제 parent 에
 *  새 하위 리소스 생성 불가는 PR #83 이 이미 고정하므로 중복하지 않는다.)
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CascadeDeleteConsistencyTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val posts: PostRepository,
    @param:Autowired private val bookmarks: PostBookmarkRepository,
    @param:Autowired private val postComments: PostCommentRepository,
    @param:Autowired private val campaigns: CampaignRepository,
    @param:Autowired private val campaignComments: CampaignCommentRepository,
) {
    private val ownerToken = jwt.issue(User(id = 1, email = "owner@test.com", passwordHash = "x", name = "개설자"))
    private val otherToken = jwt.issue(User(id = 2, email = "other@test.com", passwordHash = "x", name = "다른이"))

    private fun savePost(): String {
        val id = "cas-post-${UUID.randomUUID()}"
        posts.saveAndFlush(
            Post(
                id, Author("작성자", false), "방금", "본문", emptyList(), emptyList(), 0, 1,
                seq = 1, authorUserId = 1,
            ),
        )
        return id
    }

    private fun saveDeletableCampaign(): String {
        val id = "cas-camp-${UUID.randomUUID()}"
        campaigns.saveAndFlush(
            Campaign(
                id, "upcoming", "캠페인", "요약", "",
                "2026-08-01", "2026-08-31", "2026-09-01", "2026-09-30",
                capacity = 10, joined = 0, daysLeftLabel = "모집 예정",
                author = Author("개설자", false),
                body = CampaignBody("소개", emptyList(), emptyList()),
                seq = 1, authorUserId = 1,
            ),
        )
        return id
    }

    @Test
    fun `게시글을 삭제하면 다른 사용자의 북마크 목록에서도 제외된다`() {
        val id = savePost()
        bookmarks.saveAndFlush(PostBookmark("cas-bk-${UUID.randomUUID()}", id, 2))

        mvc.delete("/api/posts/$id") {
            headers { add("Authorization", "Bearer $ownerToken") }
        }.andExpect { status { isNoContent() } }

        mvc.get("/api/posts/bookmarks") { headers { add("Authorization", "Bearer $otherToken") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(0) }
        }
    }

    @Test
    fun `게시글을 삭제하면 댓글 목록 조회와 댓글 조작은 404다`() {
        val id = savePost()
        val commentId = "cas-pc-${UUID.randomUUID()}"
        postComments.saveAndFlush(
            PostComment(commentId, id, Author("댓글러", false), "댓글", "방금", 1, authorUserId = 1),
        )

        mvc.delete("/api/posts/$id") {
            headers { add("Authorization", "Bearer $ownerToken") }
        }.andExpect { status { isNoContent() } }

        mvc.get("/api/posts/$id/comments").andExpect { status { isNotFound() } }
        mvc.put("/api/posts/$id/comments/$commentId") {
            headers { add("Authorization", "Bearer $ownerToken") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"수정"}"""
        }.andExpect { status { isNotFound() } }
        mvc.delete("/api/posts/$id/comments/$commentId") {
            headers { add("Authorization", "Bearer $ownerToken") }
        }.andExpect { status { isNotFound() } }
    }

    @Test
    fun `캠페인을 삭제하면 댓글 목록 조회는 404다`() {
        val id = saveDeletableCampaign()
        campaignComments.saveAndFlush(
            CampaignComment(
                "cas-cc-${UUID.randomUUID()}", id, Author("댓글러", false), "댓글",
                createdAt = Instant.now(), authorUserId = 1,
            ),
        )

        mvc.delete("/api/campaigns/$id") {
            headers { add("Authorization", "Bearer $ownerToken") }
        }.andExpect { status { isNoContent() } }

        mvc.get("/api/campaigns/$id/comments").andExpect { status { isNotFound() } }
    }
}

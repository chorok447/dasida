package com.dasida.api.authorization

import com.dasida.api.auth.User
import com.dasida.api.campaign.Campaign
import com.dasida.api.campaign.CampaignBody
import com.dasida.api.campaign.CampaignParticipant
import com.dasida.api.campaign.CampaignParticipantRepository
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostBookmark
import com.dasida.api.post.PostBookmarkRepository
import com.dasida.api.post.PostLike
import com.dasida.api.post.PostLikeRepository
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * 사용자별 조회 상태(likedByMe/bookmarkedByMe/joinedByMe) 격리 회귀 방지.
 *
 * 각 도메인 ControllerTest 는 이 flag 들이 비로그인/미참여 viewer 에게 false 임을 이미 고정한다. 다만 그 검증은
 * 모두 **아무 사용자도 해당 상태를 가지지 않은** 리소스에서 이뤄진다. 그래서 Service 계층 분리 후 viewer scope 를
 * 놓친 조회(예: `existsByPostId` 로 격하되어 viewer 무관하게 true 반환)는 어떤 기존 테스트도 잡지 못한다.
 * 여기서는 **다른 사용자(user2)가 좋아요/북마크/참여한** 리소스를 익명 및 다른 로그인 사용자(user1)가 조회할 때
 * 개인 상태가 섞이지 않는지를 고정한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ReadStateIsolationBoundaryTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val posts: PostRepository,
    @param:Autowired private val likes: PostLikeRepository,
    @param:Autowired private val bookmarks: PostBookmarkRepository,
    @param:Autowired private val campaigns: CampaignRepository,
    @param:Autowired private val participants: CampaignParticipantRepository,
) {
    private val viewerToken = jwt.issue(User(id = 1, email = "viewer@test.com", passwordHash = "x", name = "조회자"))
    private val other = 2L

    private fun savePost(): String {
        val id = "iso-post-${UUID.randomUUID()}"
        posts.saveAndFlush(
            Post(
                id = id,
                author = Author("작성자", false),
                time = "방금",
                text = "본문",
                tags = emptyList(),
                images = emptyList(),
                likes = 1,
                comments = 0,
                seq = 1,
                authorUserId = 9,
            ),
        )
        return id
    }

    private fun saveCampaign(): String {
        val id = "iso-camp-${UUID.randomUUID()}"
        campaigns.saveAndFlush(
            Campaign(
                id = id,
                status = "open",
                title = "캠페인",
                summary = "요약",
                thumb = "",
                recruitStart = "2026-07-01",
                recruitEnd = "2026-07-31",
                runStart = "2026-08-01",
                runEnd = "2026-08-31",
                capacity = 10,
                joined = 1,
                daysLeftLabel = "모집중",
                author = Author("개설자", false),
                body = CampaignBody("소개", emptyList(), emptyList()),
                seq = 1,
                authorUserId = 9,
            ),
        )
        return id
    }

    private fun getPost(id: String, bearer: String? = null) = mvc.get("/api/posts/$id") {
        if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
    }

    private fun getPostList(bearer: String? = null) = mvc.get("/api/posts") {
        if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
    }

    private fun getCampaign(id: String, bearer: String? = null) = mvc.get("/api/campaigns/$id") {
        if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
    }

    private fun getCampaignList(bearer: String? = null) = mvc.get("/api/campaigns") {
        if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
    }

    @Test
    fun `다른 사용자가 좋아요-북마크한 게시글 상세는 익명 조회에서 개인 상태가 false 다`() {
        val id = savePost()
        likes.saveAndFlush(PostLike("iso-lk-${UUID.randomUUID()}", id, other))
        bookmarks.saveAndFlush(PostBookmark("iso-bk-${UUID.randomUUID()}", id, other))

        getPost(id).andExpect {
            status { isOk() }
            jsonPath("$.likedByMe") { value(false) }
            jsonPath("$.bookmarkedByMe") { value(false) }
        }
    }

    @Test
    fun `다른 사용자가 좋아요-북마크한 게시글 상세는 다른 로그인 사용자 조회에서 개인 상태가 false 다`() {
        val id = savePost()
        likes.saveAndFlush(PostLike("iso-lk-${UUID.randomUUID()}", id, other))
        bookmarks.saveAndFlush(PostBookmark("iso-bk-${UUID.randomUUID()}", id, other))

        getPost(id, viewerToken).andExpect {
            status { isOk() }
            jsonPath("$.likedByMe") { value(false) }
            jsonPath("$.bookmarkedByMe") { value(false) }
        }
    }

    @Test
    fun `다른 사용자가 좋아요-북마크한 게시글 목록은 다른 로그인 사용자 조회에서 개인 상태가 false 다`() {
        val id = savePost()
        likes.saveAndFlush(PostLike("iso-lk-${UUID.randomUUID()}", id, other))
        bookmarks.saveAndFlush(PostBookmark("iso-bk-${UUID.randomUUID()}", id, other))

        getPostList(viewerToken).andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$id')].likedByMe") { value(org.hamcrest.Matchers.hasItem(false)) }
            jsonPath("$[?(@.id == '$id')].bookmarkedByMe") { value(org.hamcrest.Matchers.hasItem(false)) }
        }
    }

    @Test
    fun `다른 사용자가 참여한 캠페인 상세는 익명 조회에서 joinedByMe false 다`() {
        val id = saveCampaign()
        participants.saveAndFlush(CampaignParticipant("iso-cp-${UUID.randomUUID()}", id, other))

        getCampaign(id).andExpect {
            status { isOk() }
            jsonPath("$.joinedByMe") { value(false) }
        }
    }

    @Test
    fun `다른 사용자가 참여한 캠페인 상세는 다른 로그인 사용자 조회에서 joinedByMe false 다`() {
        val id = saveCampaign()
        participants.saveAndFlush(CampaignParticipant("iso-cp-${UUID.randomUUID()}", id, other))

        getCampaign(id, viewerToken).andExpect {
            status { isOk() }
            jsonPath("$.joinedByMe") { value(false) }
        }
    }

    @Test
    fun `다른 사용자가 참여한 캠페인 목록은 다른 로그인 사용자 조회에서 joinedByMe false 다`() {
        val id = saveCampaign()
        participants.saveAndFlush(CampaignParticipant("iso-cp-${UUID.randomUUID()}", id, other))

        getCampaignList(viewerToken).andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$id')].joinedByMe") { value(org.hamcrest.Matchers.hasItem(false)) }
        }
    }
}

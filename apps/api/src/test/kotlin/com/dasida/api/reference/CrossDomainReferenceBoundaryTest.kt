package com.dasida.api.reference

import com.dasida.api.auth.User
import com.dasida.api.campaign.Campaign
import com.dasida.api.campaign.CampaignBody
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * 도메인 간 참조 무결성 회귀 방지.
 *
 * 두 가지 참조 경계만 좁게 보강한다.
 * 1. 신고 target 참조: 없는 대상 신고가 404 인 것은 `POST` 타입만 고정돼 있었다. POST_COMMENT/CAMPAIGN/
 *    CAMPAIGN_COMMENT 타입도 각각 자기 repo 로 대상 존재를 검증하므로 동일하게 404 인지 고정한다.
 * 2. 삭제된 parent 참조: 기존 테스트는 "처음부터 없는 id"만 404 로 고정한다. 실제 DELETE 로 제거한 게시글/캠페인에
 *    하위 리소스(댓글/참여)를 만들 수 없는지(= hard delete 라 dangling 참조가 생기지 않는지)는 고정되지 않았다.
 *    soft delete 로 회귀하면 "없는 id" 테스트는 통과해도 이 경계가 깨지므로 별도로 고정한다.
 * (parent 미존재 id 404, 댓글/참여 권한 경계(PR #74), 중복 신고 409·상태 충돌(PR #75)은 이미 고정돼 중복하지 않는다.)
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CrossDomainReferenceBoundaryTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val posts: PostRepository,
    @param:Autowired private val campaigns: CampaignRepository,
) {
    private val token = jwt.issue(User(id = 1, email = "me@test.com", passwordHash = "x", name = "나"))

    private fun savePost(): String {
        val id = "ref-post-${UUID.randomUUID()}"
        posts.saveAndFlush(
            Post(
                id, Author("작성자", false), "방금", "본문", emptyList(), emptyList(), 0, 0,
                seq = 1, authorUserId = 1,
            ),
        )
        return id
    }

    /** upcoming 상태 + 참여자/연결 게시글 없음 → DELETE 가능(정책상 upcoming 만 삭제 허용). */
    private fun saveDeletableCampaign(): String {
        val id = "ref-camp-${UUID.randomUUID()}"
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

    private fun createReport(targetType: String, targetId: String) = mvc.post("/api/reports") {
        headers { add("Authorization", "Bearer $token") }
        contentType = MediaType.APPLICATION_JSON
        content = """{"targetType":"$targetType","targetId":"$targetId","reason":"SPAM"}"""
    }

    @Test
    fun `없는 대상 신고는 댓글 캠페인 캠페인댓글 타입도 404다`() {
        listOf("POST_COMMENT", "CAMPAIGN", "CAMPAIGN_COMMENT").forEach { type ->
            createReport(type, "ref-missing-$type").andExpect { status { isNotFound() } }
        }
    }

    @Test
    fun `DELETE로 삭제한 게시글에는 댓글을 작성할 수 없다`() {
        val id = savePost()
        mvc.delete("/api/posts/$id") {
            headers { add("Authorization", "Bearer $token") }
        }.andExpect { status { isNoContent() } }

        mvc.post("/api/posts/$id/comments") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"삭제된 글에 댓글"}"""
        }.andExpect { status { isNotFound() } }
    }

    @Test
    fun `DELETE로 삭제한 캠페인에는 댓글을 작성하거나 참여할 수 없다`() {
        val id = saveDeletableCampaign()
        mvc.delete("/api/campaigns/$id") {
            headers { add("Authorization", "Bearer $token") }
        }.andExpect { status { isNoContent() } }

        mvc.post("/api/campaigns/$id/comments") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"삭제된 캠페인에 댓글"}"""
        }.andExpect { status { isNotFound() } }

        mvc.post("/api/campaigns/$id/join") {
            headers { add("Authorization", "Bearer $token") }
        }.andExpect { status { isNotFound() } }
    }
}

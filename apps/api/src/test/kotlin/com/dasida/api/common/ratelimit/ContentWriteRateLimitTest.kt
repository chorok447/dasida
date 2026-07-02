package com.dasida.api.common.ratelimit

import com.dasida.api.auth.User
import com.dasida.api.campaign.Campaign
import com.dasida.api.campaign.CampaignBody
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.report.CreateReportRequest
import com.dasida.api.security.JwtService
import tools.jackson.databind.json.JsonMapper
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(
    properties = [
        "app.rate-limit.store=memory",
        "app.rate-limit.content.comment.limit=2",
        "app.rate-limit.content.report.limit=2",
        "app.rate-limit.content.comment.window-seconds=60",
        "app.rate-limit.content.report.window-seconds=60",
        "app.rate-limit.auth.login.limit=10000",
        "app.rate-limit.auth.signup.limit=10000",
    ],
)
class ContentWriteRateLimitTest(
    @Autowired private val mvc: MockMvc,
    @Autowired private val jwt: JwtService,
    @Autowired private val mapper: JsonMapper,
    @Autowired private val campaignRepo: CampaignRepository,
    @Autowired private val postRepo: PostRepository,
) {
    private val token = jwt.issue(
        User(id = 1, email = "content-rate@test.com", passwordHash = "x", name = "작성자", verified = true),
    )

    @Test
    fun `캠페인 댓글 작성은 IP당 limit 초과 시 429를 반환한다`() {
        val campaignId = saveCampaign()
        repeat(2) { i ->
            postComment("/api/campaigns/$campaignId/comments", """{"text":"댓글 $i"}""", "203.0.113.10")
                .andExpect { status { isCreated() } }
        }
        postComment("/api/campaigns/$campaignId/comments", """{"text":"한도 초과"}""", "203.0.113.10")
            .andExpect {
                status { isTooManyRequests() }
                header { exists("Retry-After") }
            }
    }

    @Test
    fun `게시글 댓글 작성은 IP당 limit 초과 시 429를 반환한다`() {
        val postId = savePost()
        repeat(2) { i ->
            postComment("/api/posts/$postId/comments", """{"text":"댓글 $i"}""", "203.0.113.11")
                .andExpect { status { isCreated() } }
        }
        postComment("/api/posts/$postId/comments", """{"text":"한도 초과"}""", "203.0.113.11")
            .andExpect {
                status { isTooManyRequests() }
                header { exists("Retry-After") }
            }
    }

    @Test
    fun `신고 생성은 IP당 limit 초과 시 429를 반환한다`() {
        repeat(2) {
            val postId = savePost()
            mvc.post("/api/reports") {
                headers {
                    add("Authorization", "Bearer $token")
                    add("X-Forwarded-For", "203.0.113.12")
                }
                contentType = MediaType.APPLICATION_JSON
                content = mapper.writeValueAsString(CreateReportRequest("POST", postId, "SPAM"))
            }.andExpect { status { isCreated() } }
        }
        val postId = savePost()
        mvc.post("/api/reports") {
            headers {
                add("Authorization", "Bearer $token")
                add("X-Forwarded-For", "203.0.113.12")
            }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(CreateReportRequest("POST", postId, "SPAM"))
        }.andExpect {
            status { isTooManyRequests() }
            header { exists("Retry-After") }
        }
    }

    @Test
    fun `댓글 조회와 신고 목록 조회에는 rate limit이 적용되지 않는다`() {
        val campaignId = saveCampaign()
        val postId = savePost()
        repeat(5) {
            mvc.get("/api/campaigns/$campaignId/comments") {
                headers {
                    add("Authorization", "Bearer $token")
                    add("X-Forwarded-For", "203.0.113.13")
                }
            }.andExpect { status { isOk() } }
            mvc.get("/api/reports/mine") {
                headers {
                    add("Authorization", "Bearer $token")
                    add("X-Forwarded-For", "203.0.113.13")
                }
            }.andExpect { status { isOk() } }
            mvc.get("/api/posts/$postId/comments") {
                headers {
                    add("Authorization", "Bearer $token")
                    add("X-Forwarded-For", "203.0.113.13")
                }
            }.andExpect { status { isOk() } }
        }
    }

    private fun postComment(path: String, body: String, clientIp: String) =
        mvc.post(path) {
            headers {
                add("Authorization", "Bearer $token")
                add("X-Forwarded-For", clientIp)
            }
            contentType = MediaType.APPLICATION_JSON
            content = body
        }

    private fun saveCampaign(): String {
        val id = "rl-campaign-${UUID.randomUUID()}"
        campaignRepo.saveAndFlush(
            Campaign(
                id = id,
                status = "upcoming",
                title = "rate limit 캠페인",
                summary = "요약",
                thumb = "https://example.com/thumb.png",
                recruitStart = "2026-07-01",
                recruitEnd = "2026-07-31",
                runStart = "2026-08-01",
                runEnd = "2026-08-31",
                capacity = 10,
                joined = 0,
                daysLeftLabel = "모집예정",
                author = Author("개설자", false),
                body = CampaignBody("소개", emptyList(), emptyList()),
                seq = System.nanoTime(),
                authorUserId = 9,
            ),
        )
        return id
    }

    private fun savePost(): String {
        val id = "rl-post-${UUID.randomUUID()}"
        postRepo.saveAndFlush(
            Post(
                id = id,
                author = Author("작성자", false),
                time = "방금",
                text = "rate limit 게시글",
                tags = emptyList(),
                images = emptyList(),
                likes = 0,
                comments = 0,
                seq = System.nanoTime(),
                authorUserId = 9,
            ),
        )
        return id
    }
}

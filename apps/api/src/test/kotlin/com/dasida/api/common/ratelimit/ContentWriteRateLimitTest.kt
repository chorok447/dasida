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
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(
    properties = [
        "app.rate-limit.store=memory",
        "app.rate-limit.content.comment.limit=2",
        "app.rate-limit.content.post.limit=2",
        "app.rate-limit.content.campaign.limit=2",
        "app.rate-limit.content.report.limit=2",
        "app.rate-limit.content.media.limit=2",
        "app.rate-limit.content.comment.window-seconds=60",
        "app.rate-limit.content.post.window-seconds=60",
        "app.rate-limit.content.campaign.window-seconds=60",
        "app.rate-limit.content.report.window-seconds=60",
        "app.rate-limit.content.media.window-seconds=60",
        "app.rate-limit.content.interaction.limit=2",
        "app.rate-limit.content.interaction.window-seconds=60",
        "app.rate-limit.content.view.limit=2",
        "app.rate-limit.content.view.window-seconds=60",
        "app.rate-limit.auth.login.limit=10000",
        "app.rate-limit.auth.signup.limit=10000",
    ],
)
class ContentWriteRateLimitTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val mapper: JsonMapper,
    @param:Autowired private val campaignRepo: CampaignRepository,
    @param:Autowired private val postRepo: PostRepository,
) {
    private val token = jwt.issue(
        User(id = 1, email = "content-rate@test.com", passwordHash = "x", name = "작성자", verified = true),
    )

    @Test
    fun `캠페인 댓글 작성은 IP당 limit 초과 시 429를 반환한다`() {
        val campaignId = saveCampaign()
        repeat(2) { i ->
            postJson("/api/campaigns/$campaignId/comments", """{"text":"댓글 $i"}""", "203.0.113.10")
                .andExpect { status { isCreated() } }
        }
        postJson("/api/campaigns/$campaignId/comments", """{"text":"한도 초과"}""", "203.0.113.10")
            .andExpect {
                status { isTooManyRequests() }
                header { exists("Retry-After") }
            }
    }

    @Test
    fun `게시글 댓글 작성은 IP당 limit 초과 시 429를 반환한다`() {
        val postId = savePost()
        repeat(2) { i ->
            postJson("/api/posts/$postId/comments", """{"text":"댓글 $i"}""", "203.0.113.11")
                .andExpect { status { isCreated() } }
        }
        postJson("/api/posts/$postId/comments", """{"text":"한도 초과"}""", "203.0.113.11")
            .andExpect {
                status { isTooManyRequests() }
                header { exists("Retry-After") }
            }
    }

    @Test
    fun `게시글 작성은 IP당 limit 초과 시 429를 반환한다`() {
        repeat(2) { i ->
            postJson("/api/posts", """{"text":"게시글 $i"}""", "203.0.113.15")
                .andExpect { status { isCreated() } }
        }
        postJson("/api/posts", """{"text":"한도 초과"}""", "203.0.113.15")
            .andExpect {
                status { isTooManyRequests() }
                header { exists("Retry-After") }
            }
    }

    @Test
    fun `캠페인 개설은 IP당 limit 초과 시 429를 반환한다`() {
        val body = """{"title":"레이트리밋 캠페인","summary":"줍깅","capacity":20,
           "recruitStart":"2026-07-01","recruitEnd":"2026-07-31",
           "runStart":"2026-08-05","runEnd":"2026-08-30"}"""
        repeat(2) {
            postJson("/api/campaigns", body, "203.0.113.16")
                .andExpect { status { isCreated() } }
        }
        postJson("/api/campaigns", body, "203.0.113.16")
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
    fun `이미지 업로드는 IP당 limit 초과 시 429를 반환한다`() {
        val pngBytes = byteArrayOf(
            0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x00,
        )
        repeat(2) {
            mvc.perform(
                multipart("/api/media")
                    .file(MockMultipartFile("file", "photo.png", "image/png", pngBytes))
                    .header("Authorization", "Bearer $token")
                    .header("X-Forwarded-For", "203.0.113.14"),
            ).andExpect(status().isOk)
        }
        mvc.perform(
            multipart("/api/media")
                .file(MockMultipartFile("file", "photo.png", "image/png", pngBytes))
                .header("Authorization", "Bearer $token")
                .header("X-Forwarded-For", "203.0.113.14"),
        )
            .andExpect(status().isTooManyRequests)
            .andExpect(header().exists("Retry-After"))
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

    @Test
    fun `좋아요 토글은 IP당 limit 초과 시 429를 반환한다`() {
        val a = savePost()
        val b = savePost()
        val c = savePost()
        postJson("/api/posts/$a/like", "{}", "203.0.113.21").andExpect { status { isOk() } }
        postJson("/api/posts/$b/like", "{}", "203.0.113.21").andExpect { status { isOk() } }
        postJson("/api/posts/$c/like", "{}", "203.0.113.21")
            .andExpect {
                status { isTooManyRequests() }
                header { exists("Retry-After") }
            }
    }

    @Test
    fun `조회수 기록은 비로그인 포함 IP당 limit 초과 시 429를 반환한다`() {
        val postId = savePost()
        repeat(2) {
            mvc.post("/api/posts/$postId/views") {
                headers { add("X-Forwarded-For", "203.0.113.22") }
            }.andExpect { status { isNoContent() } }
        }
        mvc.post("/api/posts/$postId/views") {
            headers { add("X-Forwarded-For", "203.0.113.22") }
        }.andExpect {
            status { isTooManyRequests() }
            header { exists("Retry-After") }
        }
    }

    private fun postJson(path: String, body: String, clientIp: String) =
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

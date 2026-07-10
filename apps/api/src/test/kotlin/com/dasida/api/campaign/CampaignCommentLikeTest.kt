package com.dasida.api.campaign

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import com.dasida.api.notification.NotificationRepository
import com.dasida.api.notification.NotificationType
import com.dasida.api.post.Author
import com.dasida.api.security.JwtService
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.data.domain.PageRequest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CampaignCommentLikeTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val jwt: JwtService,
    @param:Autowired val campaigns: CampaignRepository,
    @param:Autowired val comments: CampaignCommentRepository,
    @param:Autowired val users: UserRepository,
    @param:Autowired val notifications: NotificationRepository,
) {
    private fun saveUser(name: String): User =
        users.save(User(email = "u-${UUID.randomUUID()}@t.com", passwordHash = "x", name = name))

    private fun saveCampaign(): String {
        val id = "ccl-camp-${UUID.randomUUID()}"
        campaigns.save(
            Campaign(
                id, "open", "좋아요 캠페인", "요약", "https://x/y.png",
                "2026-07-01", "2026-07-31", "2026-08-05", "2026-08-30",
                10, 0, "라벨", Author("개설자", true),
                CampaignBody("소개", emptyList(), emptyList()),
                seq = System.nanoTime(),
            ),
        )
        return id
    }

    private fun saveComment(campaignId: String, authorUserId: Long?, hidden: Boolean = false): String {
        val id = "ccl-c-${UUID.randomUUID()}"
        comments.save(
            CampaignComment(
                id = id,
                campaignId = campaignId,
                author = Author("댓글러", false),
                text = "캠페인 댓글 본문",
                createdAt = Instant.now(),
                authorUserId = authorUserId,
                hiddenAt = if (hidden) Instant.now() else null,
            ),
        )
        return id
    }

    @Test
    fun `캠페인 댓글 좋아요는 idempotent 하게 증가하고 목록에 반영되며 작성자에게 알림이 간다`() {
        val author = saveUser("댓글작성자")
        val liker = saveUser("좋아요러")
        val likerToken = jwt.issue(liker)
        val campaignId = saveCampaign()
        val commentId = saveComment(campaignId, requireNotNull(author.id))

        mvc.post("/api/campaigns/$campaignId/comments/$commentId/like") {
            header("Authorization", "Bearer $likerToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.likes", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.likedByMe", Matchers.`is`(true)) }

        mvc.post("/api/campaigns/$campaignId/comments/$commentId/like") {
            header("Authorization", "Bearer $likerToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.likes", Matchers.`is`(1)) }

        mvc.get("/api/campaigns/$campaignId/comments?page=0&size=10") {
            header("Authorization", "Bearer $likerToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.content[0].likes", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.content[0].likedByMe", Matchers.`is`(true)) }

        val notis = notifications.findByUserId(requireNotNull(author.id), PageRequest.of(0, 10))
        assert(notis.content.any { it.type == NotificationType.COMMENT_LIKED })
    }

    @Test
    fun `좋아요 취소는 idempotent 하고 숨김·없는 댓글은 404, 비로그인은 401`() {
        val self = saveUser("본인")
        val token = jwt.issue(self)
        val campaignId = saveCampaign()
        val commentId = saveComment(campaignId, requireNotNull(self.id))

        mvc.post("/api/campaigns/$campaignId/comments/$commentId/like") {
            header("Authorization", "Bearer $token")
        }.andExpect { status { isOk() } }
        // 본인 댓글 좋아요는 notify self-skip
        val notis = notifications.findByUserId(requireNotNull(self.id), PageRequest.of(0, 10))
        assert(notis.content.none { it.type == NotificationType.COMMENT_LIKED })

        mvc.delete("/api/campaigns/$campaignId/comments/$commentId/like") {
            header("Authorization", "Bearer $token")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.likes", Matchers.`is`(0)) }
            .andExpect { jsonPath("$.likedByMe", Matchers.`is`(false)) }
        mvc.delete("/api/campaigns/$campaignId/comments/$commentId/like") {
            header("Authorization", "Bearer $token")
        }.andExpect { status { isOk() } }

        val hidden = saveComment(campaignId, requireNotNull(self.id), hidden = true)
        mvc.post("/api/campaigns/$campaignId/comments/$hidden/like") {
            header("Authorization", "Bearer $token")
        }.andExpect { status { isNotFound() } }
        mvc.post("/api/campaigns/$campaignId/comments/nope/like") {
            header("Authorization", "Bearer $token")
        }.andExpect { status { isNotFound() } }
        mvc.post("/api/campaigns/$campaignId/comments/$commentId/like")
            .andExpect { status { isUnauthorized() } }
    }
}

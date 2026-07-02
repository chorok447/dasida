package com.dasida.api.notification

import com.dasida.api.auth.User
import com.dasida.api.campaign.Campaign
import com.dasida.api.campaign.CampaignBody
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.campaign.CreateCampaignCommentRequest
import com.dasida.api.campaign.FixedClockTestConfiguration
import com.dasida.api.post.Author
import com.dasida.api.post.CreateCommentRequest
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import tools.jackson.databind.json.JsonMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * 실패한 mutation 의 알림 부수효과 미생성 회귀 방지.
 *
 * NotificationEventTest 는 **성공한** 댓글/참여가 알림을 생성/생략하는지를 고정한다. 다만 세 notify 호출 지점
 * (게시글 댓글/캠페인 댓글/캠페인 참여)에서 **mutation 자체가 실패(검증/상태 충돌)한 경우** 리소스 소유자에게
 * 알림이 생성되지 않는지는 고정되지 않았다. notify 호출이 검증/상태 검사보다 앞으로 이동하는 리팩터링이 있으면
 * 실패 요청이 잘못 알림을 만들 수 있어, 각 지점의 실패 경로에서 알림 부재를 고정한다.
 * (실패 status 자체는 PR #75/기존 테스트가, 강제 퇴장 실패-무알림은 CampaignParticipantRemovalControllerTest 가
 *  이미 고정하므로 중복하지 않는다.)
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Import(FixedClockTestConfiguration::class)
class NotificationFailureSideEffectTest(
    @Autowired private val mvc: MockMvc,
    @Autowired private val jwt: JwtService,
    @Autowired private val mapper: JsonMapper,
    @Autowired private val posts: PostRepository,
    @Autowired private val campaigns: CampaignRepository,
    @Autowired private val notifications: NotificationRepository,
) {
    private val owner = 1L
    private val actor = 2L
    private val actorToken = jwt.issue(
        User(id = actor, email = "actor@test.com", passwordHash = "x", name = "행동한사람", verified = false),
    )

    private fun eventsAbout(idFragment: String) = notifications.findAll().filter { it.href.contains(idFragment) }

    private fun savePost(): String {
        val id = "nf-post-${UUID.randomUUID()}"
        posts.saveAndFlush(
            Post(
                id, Author("작성자", true), "방금 전", "본문", emptyList(), emptyList(), 0, 0,
                seq = 1, authorUserId = owner,
            ),
        )
        return id
    }

    private fun saveCampaign(status: String): String {
        val id = "nf-camp-${UUID.randomUUID()}"
        campaigns.saveAndFlush(
            Campaign(
                id, status, "캠페인 제목", "요약", "https://example.com/t.png",
                "2026-06-01", "2026-12-31", "2026-07-01", "2026-12-31",
                capacity = 10, joined = 0, daysLeftLabel = "모집중",
                author = Author("개설자", true),
                body = CampaignBody("소개", emptyList(), emptyList()),
                seq = System.nanoTime(), authorUserId = owner,
            ),
        )
        return id
    }

    @Test
    fun `타인 게시글에 빈 댓글 작성이 실패하면 작성자에게 알림이 없다`() {
        val postId = savePost()

        mvc.post("/api/posts/$postId/comments") {
            headers { add("Authorization", "Bearer $actorToken") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(CreateCommentRequest("   "))
        }.andExpect { status { isBadRequest() } }

        assertThat(eventsAbout(postId)).isEmpty()
    }

    @Test
    fun `타인 캠페인에 빈 댓글 작성이 실패하면 개설자에게 알림이 없다`() {
        val campaignId = saveCampaign(status = "open")

        mvc.post("/api/campaigns/$campaignId/comments") {
            headers { add("Authorization", "Bearer $actorToken") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(CreateCampaignCommentRequest("   "))
        }.andExpect { status { isBadRequest() } }

        assertThat(eventsAbout(campaignId)).isEmpty()
    }

    @Test
    fun `모집 중이 아닌 캠페인 참여가 실패하면 개설자에게 알림이 없다`() {
        val campaignId = saveCampaign(status = "closed")

        mvc.post("/api/campaigns/$campaignId/join") {
            headers { add("Authorization", "Bearer $actorToken") }
        }.andExpect { status { is4xxClientError() } }

        assertThat(eventsAbout(campaignId)).isEmpty()
    }
}

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
import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** 도메인 이벤트(게시글/캠페인 댓글, 캠페인 참여)에서 알림이 생성/생략되는지 검증. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Import(FixedClockTestConfiguration::class)
class NotificationEventTest(
    @Autowired private val mvc: MockMvc,
    @Autowired private val jwt: JwtService,
    @Autowired private val mapper: ObjectMapper,
    @Autowired private val posts: PostRepository,
    @Autowired private val campaigns: CampaignRepository,
    @Autowired private val notifications: NotificationRepository,
) {
    private val owner = 1L
    private val actor = 2L
    private val actorToken = jwt.issue(
        User(id = actor, email = "actor@test.com", passwordHash = "x", name = "행동한사람", verified = false),
    )
    private val ownerToken = jwt.issue(
        User(id = owner, email = "owner@test.com", passwordHash = "x", name = "개설자", verified = true),
    )

    // 동시성 테스트(@Transactional 아님)가 커밋한 알림이 테이블에 남을 수 있어, 전역 count 대신
    // 이 테스트가 만든 고유 엔티티 id(href)로 한정해 단언한다.
    private fun eventsAbout(idFragment: String) = notifications.findAll().filter { it.href.contains(idFragment) }

    private fun savePost(authorUserId: Long?): String {
        val id = "p-${UUID.randomUUID()}"
        posts.saveAndFlush(
            Post(
                id = id,
                author = Author("작성자", true),
                time = "방금 전",
                text = "본문",
                tags = emptyList(),
                images = emptyList(),
                likes = 0,
                comments = 0,
                authorUserId = authorUserId,
            ),
        )
        return id
    }

    private fun saveCampaign(authorUserId: Long?): String {
        val id = "c-${UUID.randomUUID()}"
        campaigns.saveAndFlush(
            Campaign(
                id = id,
                status = "open",
                title = "캠페인 제목",
                summary = "요약",
                thumb = "https://example.com/t.png",
                recruitStart = "2026-06-01",
                recruitEnd = "2026-12-31",
                runStart = "2026-07-01",
                runEnd = "2026-12-31",
                capacity = 10,
                joined = 0,
                daysLeftLabel = "모집중",
                author = Author("개설자", true),
                body = CampaignBody("소개", emptyList(), emptyList()),
                seq = System.nanoTime(),
                authorUserId = authorUserId,
            ),
        )
        return id
    }

    private fun comment(postId: String, bearer: String) = mvc.post("/api/posts/$postId/comments") {
        headers { add("Authorization", "Bearer $bearer") }
        contentType = MediaType.APPLICATION_JSON
        content = mapper.writeValueAsString(CreateCommentRequest("댓글"))
    }

    private fun campaignComment(campaignId: String, bearer: String) =
        mvc.post("/api/campaigns/$campaignId/comments") {
            headers { add("Authorization", "Bearer $bearer") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(CreateCampaignCommentRequest("댓글"))
        }

    private fun join(campaignId: String, bearer: String) = mvc.post("/api/campaigns/$campaignId/join") {
        headers { add("Authorization", "Bearer $bearer") }
    }

    @Test
    fun `내 게시글에 타인이 댓글을 달면 알림이 생성된다`() {
        val postId = savePost(authorUserId = owner)

        comment(postId, actorToken).andExpect { status { isCreated() } }

        val list = eventsAbout(postId)
        assertThat(list).hasSize(1)
        assertThat(list[0].userId).isEqualTo(owner)
        assertThat(list[0].type).isEqualTo(NotificationType.POST_COMMENT_CREATED)
        assertThat(list[0].href).isEqualTo("/posts/$postId")
        assertThat(list[0].title).contains("행동한사람")
        assertThat(list[0].readAt).isNull()
    }

    @Test
    fun `내가 내 게시글에 댓글을 달면 알림이 없다`() {
        val postId = savePost(authorUserId = owner)
        comment(postId, ownerToken).andExpect { status { isCreated() } }
        assertThat(eventsAbout(postId)).isEmpty()
    }

    @Test
    fun `authorUserId 없는 게시글 댓글은 알림이 없다`() {
        val postId = savePost(authorUserId = null)
        comment(postId, actorToken).andExpect { status { isCreated() } }
        assertThat(eventsAbout(postId)).isEmpty()
    }

    @Test
    fun `내 캠페인에 타인이 댓글을 달면 알림이 생성된다`() {
        val campaignId = saveCampaign(authorUserId = owner)
        campaignComment(campaignId, actorToken).andExpect { status { isCreated() } }

        val list = eventsAbout(campaignId)
        assertThat(list).hasSize(1)
        assertThat(list[0].userId).isEqualTo(owner)
        assertThat(list[0].type).isEqualTo(NotificationType.CAMPAIGN_COMMENT_CREATED)
        assertThat(list[0].href).isEqualTo("/campaigns/$campaignId")
    }

    @Test
    fun `내가 내 캠페인에 댓글을 달면 알림이 없다`() {
        val campaignId = saveCampaign(authorUserId = owner)
        campaignComment(campaignId, ownerToken).andExpect { status { isCreated() } }
        assertThat(eventsAbout(campaignId)).isEmpty()
    }

    @Test
    fun `내 캠페인에 타인이 참여하면 알림이 생성된다`() {
        val campaignId = saveCampaign(authorUserId = owner)
        join(campaignId, actorToken).andExpect { status { isOk() } }

        val list = eventsAbout(campaignId)
        assertThat(list).hasSize(1)
        assertThat(list[0].userId).isEqualTo(owner)
        assertThat(list[0].type).isEqualTo(NotificationType.CAMPAIGN_JOINED)
        assertThat(list[0].href).isEqualTo("/campaigns/$campaignId/participants")
    }

    @Test
    fun `이미 참여 중인 사용자의 멱등 join은 알림을 추가 생성하지 않는다`() {
        val campaignId = saveCampaign(authorUserId = owner)
        join(campaignId, actorToken).andExpect { status { isOk() } }
        join(campaignId, actorToken).andExpect { status { isOk() } }
        assertThat(eventsAbout(campaignId)).hasSize(1)
    }

    @Test
    fun `개설자 본인이 참여하면 알림이 없다`() {
        val campaignId = saveCampaign(authorUserId = owner)
        join(campaignId, ownerToken).andExpect { status { isOk() } }
        assertThat(eventsAbout(campaignId)).isEmpty()
    }

    @Test
    fun `authorUserId 없는 캠페인 참여와 댓글은 알림이 없다`() {
        val campaignId = saveCampaign(authorUserId = null)
        join(campaignId, actorToken).andExpect { status { isOk() } }
        campaignComment(campaignId, actorToken).andExpect { status { isCreated() } }
        assertThat(eventsAbout(campaignId)).isEmpty()
    }
}

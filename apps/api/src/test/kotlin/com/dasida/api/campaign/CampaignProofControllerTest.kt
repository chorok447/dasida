package com.dasida.api.campaign

import com.dasida.api.auth.User
import com.dasida.api.notification.NotificationRepository
import com.dasida.api.post.Author
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.data.domain.PageRequest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.json.JsonMapper
import java.time.Instant
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CampaignProofControllerTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val mapper: JsonMapper,
    @param:Autowired private val campaignRepo: CampaignRepository,
    @param:Autowired private val proofRepo: CampaignProofRepository,
    @param:Autowired private val participantRepo: CampaignParticipantRepository,
    @param:Autowired private val notificationRepo: NotificationRepository,
) {
    // TestUserSeed 가 만든 활성 사용자 row 를 가리키는 고정 id 토큰.
    private val participantToken = jwt.issue(
        User(id = 1, email = "proof@test.com", passwordHash = "x", name = "참여자", verified = true),
    )
    private val strangerToken = jwt.issue(
        User(id = 2, email = "stranger-proof@test.com", passwordHash = "x", name = "비참여자", verified = false),
    )

    private fun saveCampaign(status: String = "open", authorUserId: Long? = 4): String {
        val id = "proof-c-${UUID.randomUUID()}"
        campaignRepo.saveAndFlush(
            Campaign(
                id = id,
                status = status,
                title = "인증 캠페인",
                summary = "요약",
                thumb = "https://example.com/thumb.png",
                recruitStart = "2026-07-01",
                recruitEnd = "2026-07-31",
                runStart = "2026-08-01",
                runEnd = "2026-08-31",
                capacity = 10,
                joined = 1,
                daysLeftLabel = "모집중",
                author = Author("개설자", false),
                body = CampaignBody("소개", emptyList(), emptyList()),
                seq = System.nanoTime(),
                authorUserId = authorUserId,
            ),
        )
        return id
    }

    private fun joinAsParticipant(campaignId: String, userId: Long = 1) {
        participantRepo.saveAndFlush(
            CampaignParticipant(id = "part-${UUID.randomUUID()}", campaignId = campaignId, userId = userId),
        )
    }

    private fun createProof(
        campaignId: String,
        text: String = "인증 소감",
        images: List<String> = listOf("https://example.com/proof.jpg"),
        bearer: String? = participantToken,
    ) = mvc.post("/api/campaigns/$campaignId/proofs") {
        if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
        contentType = MediaType.APPLICATION_JSON
        content = mapper.writeValueAsString(CreateCampaignProofRequest(text = text, images = images))
    }

    @Test
    fun `참여자는 인증을 작성하고 목록에서 확인한다`() {
        val campaignId = saveCampaign()
        joinAsParticipant(campaignId)

        createProof(campaignId)
            .andExpect { status { isCreated() } }
            .andExpect { jsonPath("$.text", Matchers.`is`("인증 소감")) }
            .andExpect { jsonPath("$.images.length()", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.ownedByMe", Matchers.`is`(true)) }

        mvc.get("/api/campaigns/$campaignId/proofs") {
            headers { add("Authorization", "Bearer $participantToken") }
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.totalElements", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.proofedByMe", Matchers.`is`(true)) }

        // 개설자(4)에게 알림이 생성된다.
        val notified = notificationRepo.findByUserId(4L, PageRequest.of(0, 10))
            .content.count { it.type == "CAMPAIGN_PROOF_CREATED" }
        assertThat(notified).isEqualTo(1)
    }

    @Test
    fun `비참여자는 403, 모집 전 캠페인은 409`() {
        val campaignId = saveCampaign()
        createProof(campaignId, bearer = strangerToken)
            .andExpect { status { isForbidden() } }

        val upcomingId = saveCampaign(status = "upcoming")
        joinAsParticipant(upcomingId)
        createProof(upcomingId)
            .andExpect { status { isConflict() } }
    }

    @Test
    fun `1인 1인증 - 중복 작성은 409, 삭제 후 재작성은 허용`() {
        val campaignId = saveCampaign()
        joinAsParticipant(campaignId)

        val body = createProof(campaignId).andExpect { status { isCreated() } }
            .andReturn().response.contentAsString
        val proofId = mapper.readTree(body).get("id").asString()

        createProof(campaignId, text = "두 번째")
            .andExpect { status { isConflict() } }

        mvc.delete("/api/campaigns/$campaignId/proofs/$proofId") {
            headers { add("Authorization", "Bearer $participantToken") }
        }.andExpect { status { isNoContent() } }

        createProof(campaignId, text = "다시 작성")
            .andExpect { status { isCreated() } }
    }

    @Test
    fun `타인의 인증은 삭제할 수 없다`() {
        val campaignId = saveCampaign()
        joinAsParticipant(campaignId)
        val body = createProof(campaignId).andReturn().response.contentAsString
        val proofId = mapper.readTree(body).get("id").asString()

        mvc.delete("/api/campaigns/$campaignId/proofs/$proofId") {
            headers { add("Authorization", "Bearer $strangerToken") }
        }.andExpect { status { isForbidden() } }
    }

    @Test
    fun `숨김 인증은 목록에서 제외되고 proofedByMe 는 유지된다`() {
        val campaignId = saveCampaign()
        proofRepo.saveAndFlush(
            CampaignProof(
                id = "cpr-${UUID.randomUUID()}",
                campaignId = campaignId,
                author = Author("참여자", true),
                text = "숨김 대상",
                images = emptyList(),
                createdAt = Instant.now(),
                authorUserId = 1,
                hiddenAt = Instant.now(),
            ),
        )

        mvc.get("/api/campaigns/$campaignId/proofs") {
            headers { add("Authorization", "Bearer $participantToken") }
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.totalElements", Matchers.`is`(0)) }
            .andExpect { jsonPath("$.proofedByMe", Matchers.`is`(true)) }
    }

    @Test
    fun `빈 소감은 400, 비로그인 작성은 401`() {
        val campaignId = saveCampaign()
        joinAsParticipant(campaignId)

        createProof(campaignId, text = "  ")
            .andExpect { status { isBadRequest() } }

        createProof(campaignId, bearer = null)
            .andExpect { status { isUnauthorized() } }
    }
}

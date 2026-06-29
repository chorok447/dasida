package com.dasida.api.campaign

import com.dasida.api.auth.User
import com.dasida.api.notification.NotificationRepository
import com.dasida.api.notification.NotificationType
import com.dasida.api.post.Author
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CampaignParticipantRemovalControllerTest(
    @Autowired private val mvc: MockMvc,
    @Autowired private val jwt: JwtService,
    @Autowired private val campaignRepo: CampaignRepository,
    @Autowired private val participantRepo: CampaignParticipantRepository,
    @Autowired private val notifications: NotificationRepository,
) {
    private val owner = 1L
    private val ownerToken = jwt.issue(User(id = owner, email = "owner@t.com", passwordHash = "x", name = "개설자", verified = true))
    private val strangerToken = jwt.issue(User(id = 9L, email = "stranger@t.com", passwordHash = "x", name = "남", verified = false))

    private fun saveCampaign(status: String = "open", joined: Int = 1, authorUserId: Long? = owner): String {
        val id = "rm-c-${UUID.randomUUID()}"
        campaignRepo.saveAndFlush(
            Campaign(
                id, status, "퇴장 캠페인", "요약", "https://x/y.png",
                "2026-07-01", "2026-07-31", "2026-08-05", "2026-08-30",
                10, joined, "라벨", Author("개설자", true),
                CampaignBody("소개", emptyList(), emptyList()),
                seq = System.nanoTime(),
                authorUserId = authorUserId,
            ),
        )
        return id
    }

    private fun addParticipant(campaignId: String, userId: Long): String {
        val id = "cp-${UUID.randomUUID()}"
        participantRepo.saveAndFlush(CampaignParticipant(id, campaignId, userId))
        return id
    }

    private fun remove(campaignId: String, participantId: String, bearer: String? = ownerToken) =
        mvc.delete("/api/campaigns/$campaignId/participants/$participantId") {
            if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
        }

    private fun join(campaignId: String, bearer: String) =
        mvc.post("/api/campaigns/$campaignId/join") {
            headers { add("Authorization", "Bearer $bearer") }
        }

    private fun removalNotificationsFor(campaignId: String) =
        notifications.findAll().filter {
            it.href == "/campaigns/$campaignId" && it.type == NotificationType.CAMPAIGN_PARTICIPATION_REMOVED
        }

    // ---- 접근 제어 ----

    @Test
    fun `비로그인 제거는 401`() {
        val id = saveCampaign()
        val pid = addParticipant(id, 2L)
        remove(id, pid, bearer = null).andExpect { status { isUnauthorized() } }
        assertThat(participantRepo.existsById(pid)).isTrue()
    }

    @Test
    fun `개설자는 open 캠페인 참가자를 제거하고 갱신된 joined를 받는다`() {
        val id = saveCampaign(joined = 1)
        val pid = addParticipant(id, 2L)

        remove(id, pid).andExpect {
            status { isOk() }
            jsonPath("$.campaignId") { value(id) }
            jsonPath("$.participantId") { value(pid) }
            jsonPath("$.removed") { value(true) }
            jsonPath("$.joined") { value(0) }
            jsonPath("$.userId") { doesNotExist() }
        }
        assertThat(participantRepo.existsById(pid)).isFalse()
        assertThat(campaignRepo.findById(id).get().joined).isEqualTo(0)
    }

    @Test
    fun `다른 사용자는 403이고 데이터를 유지한다`() {
        val id = saveCampaign(joined = 1)
        val pid = addParticipant(id, 2L)
        remove(id, pid, bearer = strangerToken).andExpect { status { isForbidden() } }
        assertThat(participantRepo.existsById(pid)).isTrue()
        assertThat(campaignRepo.findById(id).get().joined).isEqualTo(1)
    }

    @Test
    fun `authorUserId 없는 레거시 캠페인은 403`() {
        val id = saveCampaign(joined = 1, authorUserId = null)
        val pid = addParticipant(id, 2L)
        remove(id, pid).andExpect { status { isForbidden() } }
        assertThat(participantRepo.existsById(pid)).isTrue()
    }

    @Test
    fun `없는 캠페인은 404`() {
        remove("rm-missing", "cp-missing").andExpect { status { isNotFound() } }
    }

    @Test
    fun `다른 캠페인의 participantId는 404`() {
        val id = saveCampaign()
        val otherId = saveCampaign()
        val otherPid = addParticipant(otherId, 2L)
        remove(id, otherPid).andExpect { status { isNotFound() } }
        assertThat(participantRepo.existsById(otherPid)).isTrue()
    }

    @Test
    fun `없는 participantId는 404`() {
        val id = saveCampaign()
        remove(id, "cp-missing").andExpect { status { isNotFound() } }
    }

    // ---- 상태 정책 ----

    @Test
    fun `upcoming과 closed 캠페인 제거는 409이고 데이터를 유지한다`() {
        for (status in listOf("upcoming", "closed")) {
            val id = saveCampaign(status = status, joined = 1)
            val pid = addParticipant(id, 2L)
            remove(id, pid).andExpect { status { isConflict() } }
            assertThat(participantRepo.existsById(pid)).isTrue()
            assertThat(campaignRepo.findById(id).get().joined).isEqualTo(1)
            assertThat(removalNotificationsFor(id)).isEmpty()
        }
    }

    @Test
    fun `반복 제거는 404`() {
        val id = saveCampaign(joined = 1)
        val pid = addParticipant(id, 2L)
        remove(id, pid).andExpect { status { isOk() } }
        remove(id, pid).andExpect { status { isNotFound() } }
    }

    // ---- 데이터 정합성 ----

    @Test
    fun `joined는 0 미만으로 내려가지 않는다`() {
        // joined=0 인데 participant 가 남은 비정상 상태에서도 floor 0 을 유지한다.
        val id = saveCampaign(joined = 0)
        val pid = addParticipant(id, 2L)
        remove(id, pid).andExpect {
            status { isOk() }
            jsonPath("$.joined") { value(0) }
        }
        assertThat(campaignRepo.findById(id).get().joined).isEqualTo(0)
    }

    @Test
    fun `한 명을 제거해도 다른 참가자는 유지된다`() {
        val id = saveCampaign(joined = 2)
        val keep = addParticipant(id, 2L)
        val drop = addParticipant(id, 3L)
        remove(id, drop).andExpect { status { isOk() } }
        assertThat(participantRepo.existsById(drop)).isFalse()
        assertThat(participantRepo.existsById(keep)).isTrue()
        assertThat(campaignRepo.findById(id).get().joined).isEqualTo(1)
    }

    @Test
    fun `제거된 사용자는 다시 참여할 수 있다`() {
        val id = saveCampaign(joined = 1)
        val pid = addParticipant(id, 2L)
        remove(id, pid).andExpect { status { isOk() } }

        val rejoiner = jwt.issue(User(id = 2L, email = "p2@t.com", passwordHash = "x", name = "참가자2", verified = false))
        join(id, rejoiner).andExpect { status { isOk() } }
        assertThat(participantRepo.existsByCampaignIdAndUserId(id, 2L)).isTrue()
        assertThat(campaignRepo.findById(id).get().joined).isEqualTo(1)
    }

    @Test
    fun `정원이 찬 캠페인에서 한 명 제거 후 다른 사용자가 참여할 수 있다`() {
        val id = saveCampaign(joined = 2)
        campaignRepo.saveAndFlush(campaignRepo.findById(id).get().apply { capacity = 2 })
        val pid = addParticipant(id, 2L)
        addParticipant(id, 3L)

        val newcomer = jwt.issue(User(id = 4L, email = "p4@t.com", passwordHash = "x", name = "신규", verified = false))
        join(id, newcomer).andExpect { status { isConflict() } } // 정원 초과
        remove(id, pid).andExpect { status { isOk() } }
        join(id, newcomer).andExpect { status { isOk() } }
        assertThat(campaignRepo.findById(id).get().joined).isEqualTo(2)
        assertThat(participantRepo.countByCampaignId(id)).isEqualTo(2)
    }

    // ---- 알림 ----

    @Test
    fun `제거 성공 시 제거된 사용자에게 unread 알림이 생성되고 href가 캠페인 상세로 연결된다`() {
        val id = saveCampaign(joined = 1)
        val pid = addParticipant(id, 2L)
        remove(id, pid).andExpect { status { isOk() } }

        val created = removalNotificationsFor(id)
        assertThat(created).hasSize(1)
        assertThat(created[0].userId).isEqualTo(2L)
        assertThat(created[0].href).isEqualTo("/campaigns/$id")
        assertThat(created[0].body).isEqualTo("퇴장 캠페인")
        assertThat(created[0].readAt).isNull() // unread → unread count 증가
    }

    @Test
    fun `개설자가 자기 자신을 제거해도 알림이 생성된다`() {
        val id = saveCampaign(joined = 1)
        val pid = addParticipant(id, owner) // 개설자가 참가자이기도 한 경우
        remove(id, pid).andExpect { status { isOk() } }

        val created = removalNotificationsFor(id)
        assertThat(created).hasSize(1)
        assertThat(created[0].userId).isEqualTo(owner)
    }

    @Test
    fun `없는 participant 제거와 권한 실패에서는 알림이 없다`() {
        val missing = saveCampaign(joined = 0)
        remove(missing, "cp-missing").andExpect { status { isNotFound() } }
        assertThat(removalNotificationsFor(missing)).isEmpty()

        val forbidden = saveCampaign(joined = 1)
        val pid = addParticipant(forbidden, 2L)
        remove(forbidden, pid, bearer = strangerToken).andExpect { status { isForbidden() } }
        assertThat(removalNotificationsFor(forbidden)).isEmpty()
    }
}

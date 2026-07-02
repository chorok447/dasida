package com.dasida.api.campaign

import com.dasida.api.auth.User
import com.dasida.api.post.Author
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * 개설자 강제 퇴장(remove)의 동시성을 실제 두 thread 로 검증. 클래스에 @Transactional 을 붙이지 않아
 * worker 가 commit 된 데이터를 보고 각자 별도 트랜잭션/커넥션으로 campaign row lock 을 경쟁한다.
 * 시작은 CyclicBarrier 로 맞추고(Thread.sleep 미사용), future/executor 에 timeout 을 둔다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(FixedClockTestConfiguration::class)
class CampaignParticipantRemovalConcurrencyTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val jwt: JwtService,
    @param:Autowired val campaignRepo: CampaignRepository,
    @param:Autowired val participantRepo: CampaignParticipantRepository,
) {
    private val ownerId = 801L
    private val ownerToken = jwt.issue(User(id = ownerId, email = "rmowner@t.com", passwordHash = "x", name = "개설자", verified = true))

    private fun tokenFor(userId: Long) = jwt.issue(
        User(id = userId, email = "u$userId@t.com", passwordHash = "x", name = "유저$userId", verified = false),
    )

    private fun saveOpenCampaign(capacity: Int, joined: Int): String {
        val id = "conc-rm-${UUID.randomUUID()}"
        campaignRepo.saveAndFlush(
            Campaign(
                id, "open", "퇴장 동시성 캠페인", "요약", "https://x/y.png",
                "2026-07-01", "2026-07-31", "2026-08-05", "2026-08-30",
                capacity, joined, "라벨", Author("개설자", true),
                CampaignBody("소개", emptyList(), emptyList()),
                authorUserId = ownerId,
            ),
        )
        return id
    }

    private fun addParticipant(campaignId: String, userId: Long): String {
        val id = "cp-${UUID.randomUUID()}"
        participantRepo.saveAndFlush(CampaignParticipant(id, campaignId, userId))
        return id
    }

    private fun removeStatus(id: String, participantId: String): Int =
        mvc.delete("/api/campaigns/$id/participants/$participantId") {
            headers { add("Authorization", "Bearer $ownerToken") }
        }.andReturn().response.status

    private fun leaveStatus(id: String, token: String): Int =
        mvc.delete("/api/campaigns/$id/join") {
            headers { add("Authorization", "Bearer $token") }
        }.andReturn().response.status

    private fun joinStatus(id: String, token: String): Int =
        mvc.post("/api/campaigns/$id/join") {
            headers { add("Authorization", "Bearer $token") }
        }.andReturn().response.status

    private fun closeStatus(id: String): Int =
        mvc.put("/api/campaigns/$id/status") {
            headers { add("Authorization", "Bearer $ownerToken") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"status":"closed"}"""
        }.andReturn().response.status

    private fun <A, B> runConcurrently(first: () -> A, second: () -> B): Pair<A, B> {
        val barrier = CyclicBarrier(2)
        val pool = Executors.newFixedThreadPool(2)
        try {
            val fa = pool.submit(Callable { barrier.await(5, TimeUnit.SECONDS); first() })
            val fb = pool.submit(Callable { barrier.await(5, TimeUnit.SECONDS); second() })
            return fa.get(10, TimeUnit.SECONDS) to fb.get(10, TimeUnit.SECONDS)
        } finally {
            pool.shutdownNow()
        }
    }

    private fun cleanup(id: String) {
        participantRepo.deleteByCampaignId(id)
        campaignRepo.deleteById(id)
    }

    @Test
    fun `같은 participant에 대한 강제 퇴장과 본인 취소는 joined를 한 번만 감소시킨다`() {
        val participantId = 802L
        val id = saveOpenCampaign(capacity = 5, joined = 1)
        val pid = addParticipant(id, participantId)
        try {
            val (removeResult, leaveResult) = runConcurrently(
                { removeStatus(id, pid) },
                { leaveStatus(id, tokenFor(participantId)) },
            )

            // remove 가 먼저면 (200, 200/leave 멱등), leave 가 먼저면 (404, 200).
            assertThat(removeResult).isIn(200, 404)
            assertThat(leaveResult).isEqualTo(200)
            val campaign = campaignRepo.findById(id).get()
            assertThat(participantRepo.countByCampaignId(id)).isEqualTo(0) // 최종 participant 없음
            assertThat(campaign.joined).isEqualTo(0) // 정확히 1 감소
            assertThat(campaign.joined).isGreaterThanOrEqualTo(0)
            assertThat(campaign.joined.toLong()).isEqualTo(participantRepo.countByCampaignId(id))
        } finally {
            cleanup(id)
        }
    }

    @Test
    fun `서로 다른 participant 동시 강제 퇴장은 감소 유실 없이 각자 삭제된다`() {
        val id = saveOpenCampaign(capacity = 5, joined = 2)
        val pidA = addParticipant(id, 811L)
        val pidB = addParticipant(id, 812L)
        try {
            val (a, b) = runConcurrently({ removeStatus(id, pidA) }, { removeStatus(id, pidB) })

            assertThat(listOf(a, b)).containsExactly(200, 200)
            val campaign = campaignRepo.findById(id).get()
            assertThat(campaign.joined).isEqualTo(0) // 정확히 2 감소
            assertThat(campaign.joined.toLong()).isEqualTo(participantRepo.countByCampaignId(id))
            assertThat(participantRepo.countByCampaignId(id)).isEqualTo(0)
        } finally {
            cleanup(id)
        }
    }

    @Test
    fun `강제 퇴장과 모집 마감 동시 실행은 정책에 맞는 결과만 발생한다`() {
        val participantId = 821L
        val id = saveOpenCampaign(capacity = 5, joined = 1)
        val pid = addParticipant(id, participantId)
        try {
            val (removeResult, closeResult) = runConcurrently(
                { removeStatus(id, pid) },
                { closeStatus(id) },
            )

            assertThat(closeResult).isEqualTo(200)
            assertThat(removeResult).isIn(200, 409) // remove 먼저 200, close 먼저면 409
            val campaign = campaignRepo.findById(id).get()
            assertThat(campaign.status).isEqualTo("closed")
            val participantCount = participantRepo.countByCampaignId(id)
            if (removeResult == 200) {
                assertThat(participantCount).isEqualTo(0)
                assertThat(campaign.joined).isEqualTo(0)
            } else {
                assertThat(participantCount).isEqualTo(1)
                assertThat(campaign.joined).isEqualTo(1)
            }
            assertThat(campaign.joined.toLong()).isEqualTo(participantCount)
            assertThat(campaign.joined).isGreaterThanOrEqualTo(0)
        } finally {
            cleanup(id)
        }
    }

    @Test
    fun `강제 퇴장과 재참여 동시 실행에도 500 없이 participant와 joined가 일치한다`() {
        val userId = 831L
        val token = tokenFor(userId)
        val id = saveOpenCampaign(capacity = 5, joined = 1)
        val pid = addParticipant(id, userId)
        try {
            val (removeResult, joinResult) = runConcurrently(
                { removeStatus(id, pid) },
                { joinStatus(id, token) },
            )

            // 어떤 순서든 사용자 500/unique 위반 노출 금지.
            assertThat(removeResult).isIn(200, 404)
            assertThat(joinResult).isEqualTo(200)
            val campaign = campaignRepo.findById(id).get()
            val participantCount = participantRepo.countByCampaignId(id)
            assertThat(campaign.joined.toLong()).isEqualTo(participantCount) // 항상 일치
            assertThat(participantCount).isLessThanOrEqualTo(1) // duplicate participant 없음
            assertThat(campaign.joined).isBetween(0, campaign.capacity)
        } finally {
            cleanup(id)
        }
    }
}

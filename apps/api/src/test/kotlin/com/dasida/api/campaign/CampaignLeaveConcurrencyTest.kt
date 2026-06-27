package com.dasida.api.campaign

import com.dasida.api.auth.User
import com.dasida.api.post.Author
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
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
 * 참여 취소(leave)의 동시성을 실제 두 thread 로 검증. 클래스에 @Transactional 을 붙이지 않아
 * worker 가 commit 된 데이터를 보고 각자 별도 트랜잭션/커넥션으로 campaign row lock 을 경쟁한다.
 * 시작은 CyclicBarrier 로 맞추고(Thread.sleep 미사용), future/executor 에 timeout 을 둔다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CampaignLeaveConcurrencyTest(
    @Autowired val mvc: MockMvc,
    @Autowired val jwt: JwtService,
    @Autowired val campaignRepo: CampaignRepository,
    @Autowired val participantRepo: CampaignParticipantRepository,
) {
    private fun tokenFor(userId: Long) = jwt.issue(
        User(id = userId, email = "u$userId@t.com", passwordHash = "x", name = "유저$userId", verified = false),
    )

    private fun saveOpenCampaign(capacity: Int, joined: Int, authorUserId: Long? = null): String {
        val id = "conc-leave-${UUID.randomUUID()}"
        campaignRepo.saveAndFlush(
            Campaign(
                id, "open", "취소 동시성 캠페인", "요약", "https://x/y.png",
                "2026-07-01", "2026-07-31", "2026-08-05", "2026-08-30",
                capacity, joined, "라벨", Author("개설자", false),
                CampaignBody("소개", emptyList(), emptyList()),
                authorUserId = authorUserId,
            ),
        )
        return id
    }

    private fun addParticipant(campaignId: String, userId: Long) {
        participantRepo.saveAndFlush(CampaignParticipant("cp-${UUID.randomUUID()}", campaignId, userId))
    }

    private fun leaveStatus(id: String, token: String): Int =
        mvc.delete("/api/campaigns/$id/join") {
            headers { add("Authorization", "Bearer $token") }
        }.andReturn().response.status

    private fun joinStatus(id: String, token: String): Int =
        mvc.post("/api/campaigns/$id/join") {
            headers { add("Authorization", "Bearer $token") }
        }.andReturn().response.status

    private fun closeStatus(id: String, token: String): Int =
        mvc.put("/api/campaigns/$id/status") {
            headers { add("Authorization", "Bearer $token") }
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
    fun `같은 사용자의 동시 취소는 joined를 한 번만 감소시킨다`() {
        val token = tokenFor(701)
        val id = saveOpenCampaign(capacity = 5, joined = 1)
        addParticipant(id, 701)
        try {
            val (a, b) = runConcurrently({ leaveStatus(id, token) }, { leaveStatus(id, token) })

            assertThat(listOf(a, b)).containsExactly(200, 200) // 둘 다 멱등 성공
            val campaign = campaignRepo.findById(id).get()
            assertThat(campaign.joined).isEqualTo(0) // 정확히 1 감소
            assertThat(campaign.joined).isGreaterThanOrEqualTo(0)
            assertThat(participantRepo.countByCampaignId(id)).isEqualTo(0)
        } finally {
            cleanup(id)
        }
    }

    @Test
    fun `서로 다른 사용자의 동시 취소는 감소 유실 없이 각자 삭제된다`() {
        val t1 = tokenFor(711)
        val t2 = tokenFor(712)
        val id = saveOpenCampaign(capacity = 5, joined = 2)
        addParticipant(id, 711)
        addParticipant(id, 712)
        try {
            val (a, b) = runConcurrently({ leaveStatus(id, t1) }, { leaveStatus(id, t2) })

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
    fun `동시 취소와 모집 마감은 정책에 맞는 결과만 발생한다`() {
        val ownerId = 721L
        val participantId = 722L
        val id = saveOpenCampaign(capacity = 5, joined = 1, authorUserId = ownerId)
        addParticipant(id, participantId)
        try {
            val (leaveResult, closeResult) = runConcurrently(
                { leaveStatus(id, tokenFor(participantId)) },
                { closeStatus(id, tokenFor(ownerId)) },
            )

            assertThat(closeResult).isEqualTo(200)
            assertThat(leaveResult).isIn(200, 409)
            val campaign = campaignRepo.findById(id).get()
            assertThat(campaign.status).isEqualTo("closed")
            // 응답과 최종 데이터 일치: leave 성공이면 participant 없음·joined 0, 실패면 participant 유지·joined 1.
            val participantCount = participantRepo.countByCampaignId(id)
            if (leaveResult == 200) {
                assertThat(participantCount).isEqualTo(0)
                assertThat(campaign.joined).isEqualTo(0)
            } else {
                assertThat(participantCount).isEqualTo(1)
                assertThat(campaign.joined).isEqualTo(1)
            }
            assertThat(campaign.joined.toLong()).isEqualTo(participantCount) // 둘 다 항상 일치
            assertThat(campaign.joined).isGreaterThanOrEqualTo(0)
        } finally {
            cleanup(id)
        }
    }

    @Test
    fun `같은 사용자의 join과 leave 동시 실행 후에도 participant와 joined가 일치한다`() {
        val userId = 731L
        val token = tokenFor(userId)
        val id = saveOpenCampaign(capacity = 5, joined = 0) // 아직 참여하지 않은 상태
        try {
            val (joinResult, leaveResult) = runConcurrently(
                { joinStatus(id, token) },
                { leaveStatus(id, token) },
            )

            assertThat(joinResult).isEqualTo(200)
            assertThat(leaveResult).isEqualTo(200)
            val campaign = campaignRepo.findById(id).get()
            val participantCount = participantRepo.countByCampaignId(id)
            // 최종 joinedByMe 는 lock 획득 순서에 따라 결정되지만 카운터·row 는 반드시 일치.
            assertThat(campaign.joined.toLong()).isEqualTo(participantCount)
            assertThat(participantCount).isLessThanOrEqualTo(1) // duplicate participant 없음
            assertThat(campaign.joined).isBetween(0, campaign.capacity)
        } finally {
            cleanup(id)
        }
    }
}

package com.dasida.api.campaign

import com.dasida.api.auth.User
import com.dasida.api.post.Author
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * 실제 두 thread 로 join 동시성을 검증. 클래스에 @Transactional 을 붙이지 않아
 * worker thread 가 commit 된 데이터를 보고 각자 별도 트랜잭션/커넥션으로 row lock 을 경쟁한다.
 * 시작 시점은 CyclicBarrier 로 맞추고(Thread.sleep 미사용), future/executor 에 timeout 을 둔다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CampaignJoinConcurrencyTest(
    @Autowired val mvc: MockMvc,
    @Autowired val jwt: JwtService,
    @Autowired val campaignRepo: CampaignRepository,
    @Autowired val participantRepo: CampaignParticipantRepository,
) {
    private fun tokenFor(userId: Long) = jwt.issue(
        User(id = userId, email = "u$userId@t.com", passwordHash = "x", name = "유저$userId", verified = false),
    )

    private fun saveOpenCampaign(capacity: Int): String {
        val id = "conc-${UUID.randomUUID()}"
        // worker thread 가 볼 수 있도록 commit 된 상태로 저장.
        campaignRepo.saveAndFlush(
            Campaign(
                id, "open", "동시성 캠페인", "요약", "https://x/y.png",
                "2026-07-01", "2026-07-31", "2026-08-05", "2026-08-30",
                capacity, 0, "라벨", Author("개설자", false),
                CampaignBody("소개", emptyList(), emptyList()),
            ),
        )
        return id
    }

    private fun joinStatus(id: String, token: String): Int =
        mvc.post("/api/campaigns/$id/join") {
            headers { add("Authorization", "Bearer $token") }
        }.andReturn().response.status

    /** 두 요청을 동시에 시작시키고 각 HTTP status 를 모은다. */
    private fun joinConcurrently(id: String, tokens: List<String>): List<Int> {
        val barrier = CyclicBarrier(tokens.size)
        val pool = Executors.newFixedThreadPool(tokens.size)
        try {
            val futures = tokens.map { token ->
                pool.submit(
                    Callable {
                        barrier.await(5, TimeUnit.SECONDS) // 동시 출발
                        joinStatus(id, token)
                    },
                )
            }
            return futures.map { it.get(10, TimeUnit.SECONDS) }
        } finally {
            pool.shutdownNow()
        }
    }

    private fun cleanup(id: String) {
        participantRepo.deleteByCampaignId(id)
        campaignRepo.deleteById(id)
    }

    @Test
    fun `서로 다른 두 사용자가 마지막 한 자리에 동시 참여하면 하나만 성공한다`() {
        val id = saveOpenCampaign(capacity = 1)
        try {
            val statuses = joinConcurrently(id, listOf(tokenFor(101), tokenFor(102))).sorted()

            assertThat(statuses).containsExactly(200, 409) // 정확히 하나 성공, 하나 정원마감
            val joined = campaignRepo.findById(id).get().joined
            assertThat(joined).isEqualTo(1)
            assertThat(joined).isLessThanOrEqualTo(1) // capacity 초과 없음
            assertThat(participantRepo.countByCampaignId(id)).isEqualTo(1)
        } finally {
            cleanup(id)
        }
    }

    @Test
    fun `같은 사용자가 동시에 두 번 참여해도 idempotent 하다`() {
        val id = saveOpenCampaign(capacity = 5)
        val token = tokenFor(201)
        try {
            val statuses = joinConcurrently(id, listOf(token, token))

            assertThat(statuses).containsExactly(200, 200) // 둘 다 idempotent 성공
            assertThat(campaignRepo.findById(id).get().joined).isEqualTo(1)
            assertThat(participantRepo.countByCampaignId(id)).isEqualTo(1)
        } finally {
            cleanup(id)
        }
    }
}

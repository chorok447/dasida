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
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
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
@Import(FixedClockTestConfiguration::class)
class CampaignJoinConcurrencyTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val jwt: JwtService,
    @param:Autowired val campaignRepo: CampaignRepository,
    @param:Autowired val participantRepo: CampaignParticipantRepository,
) {
    private fun tokenFor(userId: Long) = jwt.issue(
        User(id = userId, email = "u$userId@t.com", passwordHash = "x", name = "유저$userId", verified = false),
    )

    private fun saveOpenCampaign(
        capacity: Int,
        authorUserId: Long? = null,
        recruitStart: String = "2026-07-01",
        recruitEnd: String = "2026-07-31",
    ): String {
        val id = "conc-${UUID.randomUUID()}"
        // worker thread 가 볼 수 있도록 commit 된 상태로 저장.
        campaignRepo.saveAndFlush(
            Campaign(
                id, "open", "동시성 캠페인", "요약", "https://x/y.png",
                recruitStart, recruitEnd, "2026-08-05", "2026-08-30",
                capacity, 0, "라벨", Author("개설자", false),
                CampaignBody("소개", emptyList(), emptyList()),
                authorUserId = authorUserId,
            ),
        )
        return id
    }

    private fun saveUpcomingCampaign(authorUserId: Long): String {
        val id = "conc-edit-${UUID.randomUUID()}"
        campaignRepo.saveAndFlush(
            Campaign(
                id, "upcoming", "수정 전 제목", "수정 전 요약", "https://x/before.png",
                "2026-07-01", "2026-07-31", "2026-08-05", "2026-08-30",
                5, 1, "모집예정", Author("개설자", false),
                CampaignBody("캠페인 소개", listOf("수정 전 본문"), emptyList()),
                authorUserId = authorUserId,
            ),
        )
        participantRepo.saveAndFlush(CampaignParticipant("cp-$id", id, 999))
        return id
    }

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

    private fun openStatus(id: String, token: String): Int =
        mvc.put("/api/campaigns/$id/status") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"status":"open"}"""
        }.andReturn().response.status

    private fun editStatus(id: String, token: String): Int =
        mvc.put("/api/campaigns/$id") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"title":"수정 후 제목","summary":"수정 후 요약","body":"수정 후 본문",
                "thumb":"https://x/after.png","recruitStart":"2026-09-01","recruitEnd":"2026-09-30",
                "runStart":"2026-10-05","runEnd":"2026-10-31","capacity":8}"""
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

    @Test
    fun `모집 기간 밖 동시 join은 모두 실패하고 데이터가 변하지 않는다`() {
        val id = saveOpenCampaign(
            capacity = 5,
            recruitStart = "2026-07-16",
            recruitEnd = "2026-07-31",
        )
        try {
            val statuses = joinConcurrently(id, listOf(tokenFor(211), tokenFor(212)))

            assertThat(statuses).containsOnly(409)
            assertThat(campaignRepo.findById(id).get().joined).isZero()
            assertThat(participantRepo.countByCampaignId(id)).isZero()
        } finally {
            cleanup(id)
        }
    }

    @Test
    fun `동시 join과 close는 row lock으로 직렬화되고 데이터가 일치한다`() {
        val ownerId = 301L
        val id = saveOpenCampaign(capacity = 5, authorUserId = ownerId)
        val barrier = CyclicBarrier(2)
        val pool = Executors.newFixedThreadPool(2)
        try {
            val joinFuture = pool.submit(
                Callable {
                    barrier.await(5, TimeUnit.SECONDS)
                    joinStatus(id, tokenFor(302))
                },
            )
            val closeFuture = pool.submit(
                Callable {
                    barrier.await(5, TimeUnit.SECONDS)
                    closeStatus(id, tokenFor(ownerId))
                },
            )

            val joinStatus = joinFuture.get(10, TimeUnit.SECONDS)
            val closeStatus = closeFuture.get(10, TimeUnit.SECONDS)

            assertThat(closeStatus).isEqualTo(200)
            assertThat(joinStatus).isIn(200, 400)
            val campaign = campaignRepo.findById(id).get()
            val participantCount = participantRepo.countByCampaignId(id)
            assertThat(campaign.status).isEqualTo("closed")
            assertThat(campaign.joined.toLong()).isEqualTo(participantCount)
            assertThat(campaign.joined).isLessThanOrEqualTo(campaign.capacity)
        } finally {
            pool.shutdownNow()
            cleanup(id)
        }
    }

    @Test
    fun `동시 edit과 open은 row lock으로 직렬화되고 부분 수정이 없다`() {
        val ownerId = 401L
        val ownerToken = tokenFor(ownerId)
        val id = saveUpcomingCampaign(ownerId)
        val barrier = CyclicBarrier(2)
        val pool = Executors.newFixedThreadPool(2)
        try {
            val editFuture = pool.submit(
                Callable {
                    barrier.await(5, TimeUnit.SECONDS)
                    editStatus(id, ownerToken)
                },
            )
            val openFuture = pool.submit(
                Callable {
                    barrier.await(5, TimeUnit.SECONDS)
                    openStatus(id, ownerToken)
                },
            )

            val editStatus = editFuture.get(10, TimeUnit.SECONDS)
            val openStatus = openFuture.get(10, TimeUnit.SECONDS)

            assertThat(openStatus).isEqualTo(200)
            assertThat(editStatus).isIn(200, 409)
            val campaign = campaignRepo.findById(id).get()
            assertThat(campaign.status).isEqualTo("open")
            if (editStatus == 200) {
                assertThat(campaign.title).isEqualTo("수정 후 제목")
                assertThat(campaign.summary).isEqualTo("수정 후 요약")
                assertThat(campaign.thumb).isEqualTo("https://x/after.png")
                assertThat(campaign.recruitStart).isEqualTo("2026-09-01")
                assertThat(campaign.recruitEnd).isEqualTo("2026-09-30")
                assertThat(campaign.runStart).isEqualTo("2026-10-05")
                assertThat(campaign.runEnd).isEqualTo("2026-10-31")
                assertThat(campaign.capacity).isEqualTo(8)
                assertThat(campaign.body.paragraphs).containsExactly("수정 후 본문")
            } else {
                assertThat(campaign.title).isEqualTo("수정 전 제목")
                assertThat(campaign.summary).isEqualTo("수정 전 요약")
                assertThat(campaign.thumb).isEqualTo("https://x/before.png")
                assertThat(campaign.recruitStart).isEqualTo("2026-07-01")
                assertThat(campaign.recruitEnd).isEqualTo("2026-07-31")
                assertThat(campaign.runStart).isEqualTo("2026-08-05")
                assertThat(campaign.runEnd).isEqualTo("2026-08-30")
                assertThat(campaign.capacity).isEqualTo(5)
                assertThat(campaign.body.paragraphs).containsExactly("수정 전 본문")
            }
            assertThat(campaign.joined).isEqualTo(1)
            assertThat(participantRepo.countByCampaignId(id)).isEqualTo(1)
        } finally {
            pool.shutdownNow()
            cleanup(id)
        }
    }
}

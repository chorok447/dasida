package com.dasida.api.campaign

import com.dasida.api.auth.User
import com.dasida.api.post.Author
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
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
 * 캠페인 삭제의 동시성을 실제 두 thread 로 검증. 클래스에 @Transactional 을 붙이지 않아
 * worker 가 commit 된 데이터를 보고 각자 별도 트랜잭션/커넥션으로 campaign row lock 을 경쟁한다.
 * 시작은 CyclicBarrier 로 맞추고(Thread.sleep 미사용), future/executor 에 timeout 을 둔다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CampaignDeleteConcurrencyTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val jwt: JwtService,
    @param:Autowired val campaignRepo: CampaignRepository,
    @param:Autowired val participantRepo: CampaignParticipantRepository,
    @param:Autowired val postRepo: PostRepository,
) {
    private fun tokenFor(userId: Long) = jwt.issue(
        User(id = userId, email = "u$userId@t.com", passwordHash = "x", name = "유저$userId", verified = false),
    )

    /** 삭제 가능한 깨끗한 upcoming 캠페인(참여자·연결 게시글 없음)을 commit 상태로 저장. */
    private fun saveDeletableCampaign(ownerId: Long): String {
        val id = "conc-del-${UUID.randomUUID()}"
        campaignRepo.saveAndFlush(
            Campaign(
                id, "upcoming", "삭제 대상", "요약", "https://x/y.png",
                "2026-07-01", "2026-07-31", "2026-08-05", "2026-08-30",
                10, 0, "모집예정", Author("개설자", false),
                CampaignBody("소개", emptyList(), emptyList()),
                authorUserId = ownerId,
            ),
        )
        return id
    }

    private fun deleteStatus(id: String, token: String): Int =
        mvc.delete("/api/campaigns/$id") {
            headers { add("Authorization", "Bearer $token") }
        }.andReturn().response.status

    private fun openStatus(id: String, token: String): Int =
        mvc.put("/api/campaigns/$id/status") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"status":"open"}"""
        }.andReturn().response.status

    private fun createLinkedPostStatus(campaignId: String, token: String): Int =
        mvc.post("/api/posts") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"동시 생성 게시글","campaignId":"$campaignId"}"""
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
        // orphan 여부와 무관하게 연결 게시글 → participant → campaign 순으로 정리.
        postRepo.deleteAll(postRepo.findAll().filter { it.campaignId == id })
        participantRepo.deleteByCampaignId(id)
        campaignRepo.deleteById(id)
    }

    @Test
    fun `동시 삭제와 모집 시작은 row lock으로 직렬화된다`() {
        val ownerId = 501L
        val ownerToken = tokenFor(ownerId)
        val id = saveDeletableCampaign(ownerId)
        try {
            val (deleteResult, openResult) = runConcurrently(
                { deleteStatus(id, ownerToken) },
                { openStatus(id, ownerToken) },
            )

            // 허용 결과: {204,404}(삭제 우선) 또는 {409,200}(모집 시작 우선)
            if (deleteResult == 204) {
                assertThat(openResult).isEqualTo(404)
                assertThat(campaignRepo.existsById(id)).isFalse() // 캠페인 없음
            } else {
                assertThat(deleteResult).isEqualTo(409)
                assertThat(openResult).isEqualTo(200)
                assertThat(campaignRepo.findById(id).get().status).isEqualTo("open") // 삭제된 open 불가
            }
        } finally {
            cleanup(id)
        }
    }

    @Test
    fun `동시 삭제와 연결 게시글 생성은 orphan을 만들지 않는다`() {
        val ownerId = 601L
        val ownerToken = tokenFor(ownerId)
        val authorToken = tokenFor(602L)
        val id = saveDeletableCampaign(ownerId)
        try {
            val (deleteResult, createResult) = runConcurrently(
                { deleteStatus(id, ownerToken) },
                { createLinkedPostStatus(id, authorToken) },
            )

            val campaignExists = campaignRepo.existsById(id)
            val linkedPostExists = postRepo.existsByCampaignId(id)
            // 절대 금지: 게시글은 있는데 캠페인은 없는 orphan 상태.
            assertThat(linkedPostExists && !campaignExists).isFalse()

            // 허용 결과: {204,400}(삭제 우선) 또는 {409,201}(게시글 생성 우선)
            if (createResult == 201) {
                assertThat(deleteResult).isEqualTo(409)
                assertThat(campaignExists).isTrue()
                assertThat(linkedPostExists).isTrue()
            } else {
                assertThat(createResult).isEqualTo(400)
                assertThat(deleteResult).isEqualTo(204)
                assertThat(campaignExists).isFalse()
                assertThat(linkedPostExists).isFalse()
            }
        } finally {
            cleanup(id)
        }
    }
}

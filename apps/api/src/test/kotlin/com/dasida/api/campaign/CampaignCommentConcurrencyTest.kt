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
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@SpringBootTest
@AutoConfigureMockMvc
class CampaignCommentConcurrencyTest(
    @Autowired private val mvc: MockMvc,
    @Autowired private val jwt: JwtService,
    @Autowired private val campaignRepo: CampaignRepository,
    @Autowired private val participantRepo: CampaignParticipantRepository,
    @Autowired private val commentRepo: CampaignCommentRepository,
) {
    private fun tokenFor(userId: Long) = jwt.issue(
        User(id = userId, email = "comment-$userId@test.com", passwordHash = "x", name = "유저$userId", verified = false),
    )

    private fun saveCampaign(ownerId: Long): String {
        val id = "comment-concurrency-${UUID.randomUUID()}"
        campaignRepo.saveAndFlush(
            Campaign(
                id = id,
                status = "upcoming",
                title = "동시성 캠페인",
                summary = "요약",
                thumb = "https://example.com/thumb.png",
                recruitStart = "2026-07-01",
                recruitEnd = "2026-07-31",
                runStart = "2026-08-01",
                runEnd = "2026-08-31",
                capacity = 10,
                joined = 0,
                daysLeftLabel = "모집예정",
                author = Author("개설자", false),
                body = CampaignBody("소개", emptyList(), emptyList()),
                authorUserId = ownerId,
            ),
        )
        return id
    }

    private fun createStatus(campaignId: String, token: String): Int =
        mvc.post("/api/campaigns/$campaignId/comments") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"동시에 작성한 댓글"}"""
        }.andReturn().response.status

    private fun deleteStatus(campaignId: String, token: String): Int =
        mvc.delete("/api/campaigns/$campaignId") {
            headers { add("Authorization", "Bearer $token") }
        }.andReturn().response.status

    private fun runConcurrently(first: () -> Int, second: () -> Int): Pair<Int, Int> {
        val barrier = CyclicBarrier(2)
        val pool = Executors.newFixedThreadPool(2)
        try {
            val firstResult = pool.submit(Callable { barrier.await(5, TimeUnit.SECONDS); first() })
            val secondResult = pool.submit(Callable { barrier.await(5, TimeUnit.SECONDS); second() })
            return firstResult.get(15, TimeUnit.SECONDS) to secondResult.get(15, TimeUnit.SECONDS)
        } finally {
            pool.shutdownNow()
        }
    }

    @Test
    fun `댓글 작성과 캠페인 삭제가 동시에 실행돼도 orphan 댓글이 남지 않는다`() {
        val ownerId = 901L
        val campaignId = saveCampaign(ownerId)
        try {
            val (createResult, deleteResult) = runConcurrently(
                { createStatus(campaignId, tokenFor(902L)) },
                { deleteStatus(campaignId, tokenFor(ownerId)) },
            )

            assertThat(createResult).isIn(201, 404)
            assertThat(deleteResult).isEqualTo(204)
            assertThat(campaignRepo.existsById(campaignId)).isFalse()
            assertThat(commentRepo.countByCampaignId(campaignId)).isZero()
        } finally {
            commentRepo.deleteByCampaignId(campaignId)
            participantRepo.deleteByCampaignId(campaignId)
            campaignRepo.deleteById(campaignId)
        }
    }
}

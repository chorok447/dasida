package com.dasida.api.report

import com.dasida.api.auth.User
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import tools.jackson.databind.json.JsonMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@SpringBootTest
@AutoConfigureMockMvc
class ReportConcurrencyTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val mapper: JsonMapper,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val reports: ReportRepository,
    @param:Autowired private val posts: PostRepository,
) {
    @Test
    fun `같은 사용자의 동시 중복 신고는 하나만 생성하고 다른 요청은 409`() {
        val suffix = UUID.randomUUID().toString()
        val postId = "report-race-post-$suffix"
        val reporterId = 801L
        posts.saveAndFlush(
            Post(
                postId,
                Author("작성자", false),
                "방금",
                "본문",
                emptyList(),
                emptyList(),
                0,
                0,
                seq = 1,
                authorUserId = 802,
            ),
        )
        val token = jwt.issue(
            User(id = reporterId, email = "report-race@test.com", passwordHash = "x", name = "신고자"),
        )
        val barrier = CyclicBarrier(2)
        val pool = Executors.newFixedThreadPool(2)

        try {
            val futures = List(2) {
                pool.submit(
                    Callable {
                        barrier.await(5, TimeUnit.SECONDS)
                        mvc.post("/api/reports") {
                            headers { add("Authorization", "Bearer $token") }
                            contentType = MediaType.APPLICATION_JSON
                            content = mapper.writeValueAsString(
                                CreateReportRequest("POST", postId, "SPAM"),
                            )
                        }.andReturn().response.status
                    },
                )
            }

            assertThat(futures.map { it.get(10, TimeUnit.SECONDS) }.sorted()).containsExactly(201, 409)
            assertThat(
                reports.findAll().count {
                    it.reporterUserId == reporterId &&
                        it.targetType == "POST" &&
                        it.targetId == postId
                },
            ).isEqualTo(1)
        } finally {
            pool.shutdownNow()
            reports.deleteAll()
            posts.deleteById(postId)
        }
    }
}

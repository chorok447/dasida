package com.dasida.api.query

import com.dasida.api.mapElements
import com.dasida.api.auth.User
import com.dasida.api.campaign.Campaign
import com.dasida.api.campaign.CampaignBody
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.report.Report
import com.dasida.api.report.ReportRepository
import com.dasida.api.security.JwtService
import tools.jackson.databind.json.JsonMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * 목록 조회 기본 정렬 정책 회귀 방지.
 *
 * 게시글/캠페인 목록의 **기본 정렬(seq 내림차순)** 은 개별 ControllerTest 가 `$[0]` 시드 id 만 고정할 뿐,
 * 여러 항목이 실제 seq 역순으로 오는지는 명시적으로 고정하지 않는다. 신고 목록은 seq 내림차순만 검증되고
 * **동일 seq 의 id 오름차순 tie breaker** 는 고정되지 않았다. Service 계층/repository 정렬이 리팩터링돼도
 * 이 순서가 깨지지 않도록 대표 케이스를 고정한다. (알림 목록의 seq DESC·id ASC 는 NotificationControllerTest 가
 * 이미 tie breaker 까지 고정하므로 중복하지 않는다.)
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ListOrderingBoundaryTest(
    @Autowired private val mvc: MockMvc,
    @Autowired private val mapper: JsonMapper,
    @Autowired private val jwt: JwtService,
    @Autowired private val posts: PostRepository,
    @Autowired private val campaigns: CampaignRepository,
    @Autowired private val reports: ReportRepository,
) {
    private val reporterToken = jwt.issue(User(id = 1, email = "reporter@test.com", passwordHash = "x", name = "신고자"))

    private fun savePost(seq: Long): String {
        val id = "ord-post-${UUID.randomUUID()}"
        posts.saveAndFlush(
            Post(
                id = id,
                author = Author("작성자", false),
                time = "방금",
                text = "본문",
                tags = emptyList(),
                images = emptyList(),
                likes = 0,
                comments = 0,
                seq = seq,
                authorUserId = 9,
            ),
        )
        return id
    }

    private fun saveCampaign(seq: Long): String {
        val id = "ord-camp-${UUID.randomUUID()}"
        campaigns.saveAndFlush(
            Campaign(
                id = id,
                status = "open",
                title = "캠페인",
                summary = "요약",
                thumb = "",
                recruitStart = "2026-07-01",
                recruitEnd = "2026-07-31",
                runStart = "2026-08-01",
                runEnd = "2026-08-31",
                capacity = 10,
                joined = 0,
                daysLeftLabel = "모집중",
                author = Author("개설자", false),
                body = CampaignBody("소개", emptyList(), emptyList()),
                seq = seq,
                authorUserId = 9,
            ),
        )
        return id
    }

    /** 응답 JSON 배열에서 id 순서를 뽑는다. 시드 데이터가 섞여도 내가 넣은 항목의 상대 순서만 검증한다. */
    private fun idOrder(body: String): List<String> =
        mapper.readTree(body).mapElements { it["id"].asText() }

    @Test
    fun `게시글 목록은 seq 내림차순 기본 정렬을 유지한다`() {
        val oldest = savePost(seq = 10)
        val newest = savePost(seq = 30)
        val middle = savePost(seq = 20)

        val body = mvc.get("/api/posts").andReturn().response.contentAsString
        val ids = idOrder(body)

        assertThat(ids.indexOf(newest)).isLessThan(ids.indexOf(middle))
        assertThat(ids.indexOf(middle)).isLessThan(ids.indexOf(oldest))
    }

    @Test
    fun `캠페인 목록은 seq 내림차순 기본 정렬을 유지한다`() {
        val oldest = saveCampaign(seq = 10)
        val newest = saveCampaign(seq = 30)
        val middle = saveCampaign(seq = 20)

        val body = mvc.get("/api/campaigns").andReturn().response.contentAsString
        val ids = idOrder(body)

        assertThat(ids.indexOf(newest)).isLessThan(ids.indexOf(middle))
        assertThat(ids.indexOf(middle)).isLessThan(ids.indexOf(oldest))
    }

    @Test
    fun `내 신고 목록은 seq 내림차순이며 동일 seq는 id 오름차순 tie breaker로 정렬한다`() {
        reports.saveAllAndFlush(
            listOf(
                Report("ord-report-b", 1, "POST", "t-b", "SPAM", null, "old", 5),
                Report("ord-report-a", 1, "POST", "t-a", "SPAM", null, "old", 5),
                Report("ord-report-top", 1, "POST", "t-top", "SPAM", null, "new", 9),
            ),
        )

        val body = mvc.get("/api/reports/mine") {
            headers { add("Authorization", "Bearer $reporterToken") }
        }.andReturn().response.contentAsString
        val ids = mapper.readTree(body)["content"].mapElements { it["id"].asText() }

        assertThat(ids).containsExactly("ord-report-top", "ord-report-a", "ord-report-b")
    }
}

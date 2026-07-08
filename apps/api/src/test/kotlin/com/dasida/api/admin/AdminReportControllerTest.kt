package com.dasida.api.admin

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import com.dasida.api.auth.UserRole
import com.dasida.api.campaign.Campaign
import com.dasida.api.campaign.CampaignBody
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.notification.NotificationRepository
import com.dasida.api.notification.NotificationType
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.report.Report
import com.dasida.api.report.ReportRepository
import com.dasida.api.report.ReportStatus
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.json.JsonMapper
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminReportControllerTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val mapper: JsonMapper,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val reports: ReportRepository,
    @param:Autowired private val posts: PostRepository,
    @param:Autowired private val campaigns: CampaignRepository,
    @param:Autowired private val notifications: NotificationRepository,
    @param:Autowired private val users: UserRepository,
) {
    // user 4 를 관리자로 승격해 사용한다(@Transactional 이라 테스트 후 롤백).
    private val adminToken = jwt.issue(
        User(id = 4, email = "test-user-4@dasida.local", passwordHash = "x", name = "관리자"),
    )
    private val userToken = jwt.issue(
        User(id = 1, email = "test-user-1@dasida.local", passwordHash = "x", name = "일반 사용자"),
    )

    @BeforeEach
    fun promoteAdmin() {
        val admin = users.findById(4).orElseThrow()
        admin.role = UserRole.ADMIN.name
        users.saveAndFlush(admin)
    }

    private fun savePost(authorUserId: Long? = 9): Post {
        val id = "admin-post-${UUID.randomUUID()}"
        return posts.saveAndFlush(
            Post(
                id = id,
                author = Author("작성자", false),
                time = "방금",
                text = "<p>신고 대상 <b>게시글</b> 본문</p>",
                tags = emptyList(),
                images = emptyList(),
                likes = 0,
                comments = 0,
                seq = 1,
                authorUserId = authorUserId,
            ),
        )
    }

    private fun saveCampaign(): Campaign {
        val id = "admin-campaign-${UUID.randomUUID()}"
        return campaigns.saveAndFlush(
            Campaign(
                id, "open", "신고 대상 캠페인", "요약", "",
                "2026-07-01", "2026-07-31", "2026-08-01", "2026-08-31",
                10, 0, "모집중", Author("개설자", false),
                CampaignBody("소개", emptyList(), emptyList()),
                seq = 1,
                authorUserId = 9,
            ),
        )
    }

    private fun saveReport(
        targetType: String,
        targetId: String,
        reporterUserId: Long = 1,
        seq: Long = 1,
        status: String = ReportStatus.PENDING.name,
    ): Report = reports.saveAndFlush(
        Report(
            id = "admin-report-${UUID.randomUUID()}",
            reporterUserId = reporterUserId,
            targetType = targetType,
            targetId = targetId,
            reason = "SPAM",
            detail = "반복 광고",
            time = "방금",
            seq = seq,
            status = status,
        ),
    )

    private fun resolve(reportId: String, status: String, note: String? = null, bearer: String? = adminToken) =
        mvc.patch("/api/admin/reports/$reportId") {
            if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(ResolveReportRequest(status, note))
        }

    @Test
    fun `관리자 API는 비로그인 401 일반 사용자 403`() {
        mvc.get("/api/admin/reports").andExpect { status { isUnauthorized() } }
        mvc.get("/api/admin/summary").andExpect { status { isUnauthorized() } }

        mvc.get("/api/admin/reports") {
            headers { add("Authorization", "Bearer $userToken") }
        }.andExpect { status { isForbidden() } }
        mvc.get("/api/admin/summary") {
            headers { add("Authorization", "Bearer $userToken") }
        }.andExpect { status { isForbidden() } }
        resolve("any-id", "RESOLVED", bearer = userToken).andExpect { status { isForbidden() } }
    }

    @Test
    fun `관리자 권한을 회수하면 기존 토큰으로도 즉시 403`() {
        mvc.get("/api/admin/summary") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect { status { isOk() } }

        val demoted = users.findById(4).orElseThrow()
        demoted.role = UserRole.USER.name
        users.saveAndFlush(demoted)

        mvc.get("/api/admin/summary") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect { status { isForbidden() } }
    }

    @Test
    fun `신고 목록은 최신순이고 대상 미리보기와 신고자 정보를 담는다`() {
        val post = savePost()
        saveReport("POST", post.id, seq = 1)
        val newer = saveReport("POST", post.id, reporterUserId = 2, seq = 2)

        mvc.get("/api/admin/reports") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(2) }
            jsonPath("$.content[0].id") { value(newer.id) }
            jsonPath("$.content[0].status") { value("PENDING") }
            jsonPath("$.content[0].reporter.id") { value(2) }
            jsonPath("$.content[0].reporter.email") { value("test-user-2@dasida.local") }
            // 미리보기는 HTML 태그를 제거한 발췌 + 프론트 경로.
            jsonPath("$.content[0].target.excerpt") { value("신고 대상 게시글 본문") }
            jsonPath("$.content[0].target.authorName") { value("작성자") }
            jsonPath("$.content[0].target.href") { value("/posts/${post.id}") }
            jsonPath("$.content[0].targetReportCount") { value(2) }
            jsonPath("$.pendingCount") { value(2) }
        }
    }

    @Test
    fun `상태와 대상종류 필터가 동작하고 잘못된 필터는 400`() {
        val post = savePost()
        val campaign = saveCampaign()
        saveReport("POST", post.id, seq = 1)
        saveReport("CAMPAIGN", campaign.id, seq = 2, status = ReportStatus.DISMISSED.name)

        mvc.get("/api/admin/reports?status=PENDING") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(1) }
            jsonPath("$.content[0].targetType") { value("POST") }
        }
        mvc.get("/api/admin/reports?status=DISMISSED&targetType=CAMPAIGN") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(1) }
            jsonPath("$.content[0].target.href") { value("/campaigns/${campaign.id}") }
        }
        mvc.get("/api/admin/reports?status=WRONG") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect { status { isBadRequest() } }
        mvc.get("/api/admin/reports?targetType=WRONG") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `삭제된 대상의 신고는 target이 null이다`() {
        saveReport("POST", "missing-post-id")

        mvc.get("/api/admin/reports") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].target") { value(null) }
        }
    }

    @Test
    fun `신고 처리는 상태를 바꾸고 신고자에게 알림을 보낸다`() {
        val post = savePost()
        val report = saveReport("POST", post.id)
        val before = notifications.count()

        resolve(report.id, "RESOLVED", note = " 광고 게시글 확인 ").andExpect {
            status { isOk() }
            jsonPath("$.status") { value("RESOLVED") }
            jsonPath("$.resolutionNote") { value("광고 게시글 확인") }
            jsonPath("$.resolvedAt") { isNotEmpty() }
        }

        val saved = reports.findById(report.id).orElseThrow()
        assertThat(saved.status).isEqualTo(ReportStatus.RESOLVED.name)
        assertThat(saved.resolvedByUserId).isEqualTo(4)

        assertThat(notifications.count()).isEqualTo(before + 1)
        val notification = notifications.findAll().last()
        assertThat(notification.type).isEqualTo(NotificationType.REPORT_RESOLVED)
        assertThat(notification.href).isEqualTo("/posts/${post.id}")
        assertThat(notification.body).contains("광고 게시글 확인")
    }

    @Test
    fun `기각 처리도 알림을 보내고 탈퇴한 신고자에게는 보내지 않는다`() {
        val post = savePost()
        val report = saveReport("POST", post.id)
        val deletedReporterReport = saveReport("POST", post.id, reporterUserId = 9, seq = 2)
        users.findById(9).orElseThrow().deletedAt = java.time.Instant.now()
        users.flush()
        val before = notifications.count()

        resolve(report.id, "DISMISSED").andExpect {
            status { isOk() }
            jsonPath("$.status") { value("DISMISSED") }
        }
        resolve(deletedReporterReport.id, "DISMISSED").andExpect { status { isOk() } }

        assertThat(notifications.count()).isEqualTo(before + 1)
    }

    @Test
    fun `이미 처리한 신고는 409 잘못된 입력은 400 없는 신고는 404`() {
        val post = savePost()
        val report = saveReport("POST", post.id)

        resolve(report.id, "RESOLVED").andExpect { status { isOk() } }
        resolve(report.id, "DISMISSED").andExpect { status { isConflict() } }

        val other = saveReport("POST", post.id, reporterUserId = 2, seq = 2)
        resolve(other.id, "PENDING").andExpect { status { isBadRequest() } }
        resolve(other.id, "WRONG").andExpect { status { isBadRequest() } }
        resolve(other.id, "RESOLVED", note = "a".repeat(501)).andExpect { status { isBadRequest() } }
        resolve("missing-report", "RESOLVED").andExpect { status { isNotFound() } }
    }

    @Test
    fun `summary는 대기 신고와 콘텐츠 수를 집계한다`() {
        val post = savePost()
        saveReport("POST", post.id, seq = 1)
        saveReport("POST", post.id, reporterUserId = 2, seq = 2, status = ReportStatus.RESOLVED.name)

        mvc.get("/api/admin/summary") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.pendingReports") { value(1) }
            jsonPath("$.totalReports") { value(2) }
            jsonPath("$.users") { isNumber() }
            jsonPath("$.posts") { isNumber() }
            jsonPath("$.campaigns") { isNumber() }
        }
    }

    @Test
    fun `내 프로필 응답에 role이 포함된다`() {
        mvc.get("/api/auth/me") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.role") { value("ADMIN") }
        }
        mvc.get("/api/auth/me") {
            headers { add("Authorization", "Bearer $userToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.role") { value("USER") }
        }
    }
}

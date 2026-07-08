package com.dasida.api.admin

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import com.dasida.api.auth.UserRole
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.report.Report
import com.dasida.api.report.ReportRepository
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
import java.time.Instant
import java.util.UUID

/** 관리자 감사 로그 검증: 조치별 기록(신고 처리/콘텐츠 숨김·복구/회원 정지·해제)과 조회 API. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminActionLogTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val users: UserRepository,
    @param:Autowired private val posts: PostRepository,
    @param:Autowired private val reports: ReportRepository,
    @param:Autowired private val actionLogs: AdminActionLogRepository,
) {
    private val adminToken = jwt.issue(
        User(id = 4, email = "test-user-4@dasida.local", passwordHash = "x", name = "관리자"),
    )
    private val userToken = jwt.issue(
        User(id = 2, email = "test-user-2@dasida.local", passwordHash = "x", name = "일반 사용자"),
    )

    @BeforeEach
    fun promoteAdmin() {
        val admin = users.findById(4).orElseThrow()
        admin.role = UserRole.ADMIN.name
        users.saveAndFlush(admin)
    }

    private fun savePost(): Post = posts.saveAndFlush(
        Post(
            id = "log-post-${UUID.randomUUID()}",
            author = Author("작성자", false),
            time = "방금",
            text = "감사 로그 대상 게시글",
            tags = emptyList(),
            images = emptyList(),
            likes = 0,
            comments = 0,
            seq = System.nanoTime(),
            authorUserId = 9,
        ),
    )

    private fun saveReport(targetId: String): Report = reports.saveAndFlush(
        Report(
            id = "log-report-${UUID.randomUUID()}",
            reporterUserId = 1,
            targetType = "POST",
            targetId = targetId,
            reason = "SPAM",
            detail = "반복 광고",
            time = "방금",
            seq = System.nanoTime(),
        ),
    )

    private fun adminGet(path: String) = mvc.get(path) {
        headers { add("Authorization", "Bearer $adminToken") }
    }

    private fun adminPatch(path: String, body: String) = mvc.patch(path) {
        headers { add("Authorization", "Bearer $adminToken") }
        contentType = MediaType.APPLICATION_JSON
        content = body
    }

    private fun actionsOf() = actionLogs.findAll().map { it.action }

    @Test
    fun `감사 로그 조회는 비로그인 401 일반 사용자 403`() {
        mvc.get(LOGS_PATH).andExpect { status { isUnauthorized() } }
        mvc.get(LOGS_PATH) {
            headers { add("Authorization", "Bearer $userToken") }
        }.andExpect { status { isForbidden() } }
    }

    @Test
    fun `회원 정지와 해제가 기록되고 이미 정상인 계정의 해제 재요청은 무음이다`() {
        val until = Instant.now().plusSeconds(7 * 24 * 3600)
        adminPatch("/api/admin/users/2/suspension", """{"suspendedUntil":"$until","reason":"반복 신고 누적"}""")
            .andExpect { status { isOk() } }
        adminPatch("/api/admin/users/2/suspension", """{"suspendedUntil":null}""")
            .andExpect { status { isOk() } }
        // 이미 정상인 계정 → 상태 변화 없음 → 기록 없음
        adminPatch("/api/admin/users/2/suspension", """{"suspendedUntil":null}""")
            .andExpect { status { isOk() } }

        assertThat(actionsOf()).containsExactly("USER_SUSPENDED", "USER_UNSUSPENDED")
        val suspended = actionLogs.findAll().first { it.action == "USER_SUSPENDED" }
        assertThat(suspended.adminUserId).isEqualTo(4)
        assertThat(suspended.targetType).isEqualTo("USER")
        assertThat(suspended.targetId).isEqualTo("2")
        assertThat(suspended.detail).contains("까지").contains("반복 신고 누적")
    }

    @Test
    fun `콘텐츠 숨김과 복구가 기록되고 멱등 재요청은 무음이다`() {
        val post = savePost()
        adminPatch("/api/admin/content/POST/${post.id}", """{"hidden":true,"reason":"광고 게시글"}""")
            .andExpect { status { isOk() } }
        // 이미 숨김 → no-op → 기록 없음
        adminPatch("/api/admin/content/POST/${post.id}", """{"hidden":true}""")
            .andExpect { status { isOk() } }
        adminPatch("/api/admin/content/POST/${post.id}", """{"hidden":false}""")
            .andExpect { status { isOk() } }

        assertThat(actionsOf()).containsExactly("CONTENT_HIDDEN", "CONTENT_RESTORED")
        val hidden = actionLogs.findAll().first { it.action == "CONTENT_HIDDEN" }
        assertThat(hidden.targetType).isEqualTo("POST")
        assertThat(hidden.targetId).isEqualTo(post.id)
        assertThat(hidden.detail).isEqualTo("광고 게시글")
    }

    @Test
    fun `신고 처리가 기록되고 hideContent 시 콘텐츠 숨김도 함께 기록된다`() {
        val post = savePost()
        val report = saveReport(post.id)
        adminPatch("/api/admin/reports/${report.id}", """{"status":"RESOLVED","note":"광고 확인","hideContent":true}""")
            .andExpect { status { isOk() } }

        assertThat(actionsOf()).containsExactly("REPORT_RESOLVED", "CONTENT_HIDDEN")
        val resolved = actionLogs.findAll().first { it.action == "REPORT_RESOLVED" }
        assertThat(resolved.targetType).isEqualTo("REPORT")
        assertThat(resolved.targetId).isEqualTo(report.id)
        assertThat(resolved.detail).isEqualTo("광고 확인")

        // 기각은 신고 기록만 남는다.
        val other = saveReport(savePost().id)
        adminPatch("/api/admin/reports/${other.id}", """{"status":"DISMISSED"}""")
            .andExpect { status { isOk() } }
        assertThat(actionsOf()).contains("REPORT_DISMISSED")
    }

    @Test
    fun `감사 로그 목록은 최신순이고 조치 종류로 필터된다`() {
        val post = savePost()
        adminPatch("/api/admin/content/POST/${post.id}", """{"hidden":true}""").andExpect { status { isOk() } }
        val until = Instant.now().plusSeconds(24 * 3600)
        adminPatch("/api/admin/users/2/suspension", """{"suspendedUntil":"$until"}""").andExpect { status { isOk() } }

        adminGet(LOGS_PATH).andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(2) }
            // 최신순: 나중 조치(회원 정지)가 먼저 온다.
            jsonPath("$.content[0].action") { value("USER_SUSPENDED") }
            jsonPath("$.content[0].admin.name") { value("테스트 사용자 4") }
            jsonPath("$.content[1].action") { value("CONTENT_HIDDEN") }
        }
        adminGet("$LOGS_PATH?action=CONTENT_HIDDEN").andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].targetId") { value(post.id) }
        }
        adminGet("$LOGS_PATH?action=NOT_AN_ACTION").andExpect { status { isBadRequest() } }
    }

    private companion object {
        const val LOGS_PATH = "/api/admin/logs"
    }
}

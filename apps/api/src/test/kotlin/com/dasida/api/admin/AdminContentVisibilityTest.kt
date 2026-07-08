package com.dasida.api.admin

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import com.dasida.api.auth.UserRole
import com.dasida.api.campaign.Campaign
import com.dasida.api.campaign.CampaignBody
import com.dasida.api.campaign.CampaignComment
import com.dasida.api.campaign.CampaignCommentRepository
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.notification.NotificationRepository
import com.dasida.api.notification.NotificationType
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostComment
import com.dasida.api.post.PostCommentRepository
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
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.json.JsonMapper
import java.time.Instant
import java.util.UUID

/** 관리자 콘텐츠 숨김/복구와 공개 노출 필터의 통합 동작 검증. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminContentVisibilityTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val mapper: JsonMapper,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val users: UserRepository,
    @param:Autowired private val posts: PostRepository,
    @param:Autowired private val postComments: PostCommentRepository,
    @param:Autowired private val campaigns: CampaignRepository,
    @param:Autowired private val campaignComments: CampaignCommentRepository,
    @param:Autowired private val reports: ReportRepository,
    @param:Autowired private val notifications: NotificationRepository,
) {
    private val adminToken = jwt.issue(
        User(id = 4, email = "test-user-4@dasida.local", passwordHash = "x", name = "관리자"),
    )
    private val authorToken = jwt.issue(
        User(id = 9, email = "test-user-9@dasida.local", passwordHash = "x", name = "작성자"),
    )
    private val otherToken = jwt.issue(
        User(id = 2, email = "test-user-2@dasida.local", passwordHash = "x", name = "일반 사용자"),
    )

    @BeforeEach
    fun promoteAdmin() {
        val admin = users.findById(4).orElseThrow()
        admin.role = UserRole.ADMIN.name
        users.saveAndFlush(admin)
    }

    private fun savePost(authorUserId: Long? = 9, comments: Int = 0): Post = posts.saveAndFlush(
        Post(
            id = "vis-post-${UUID.randomUUID()}",
            author = Author("작성자", false),
            time = "방금",
            text = "숨김 대상 게시글",
            tags = emptyList(),
            images = emptyList(),
            likes = 0,
            comments = comments,
            seq = System.nanoTime(),
            authorUserId = authorUserId,
        ),
    )

    private fun saveComment(postId: String, authorUserId: Long? = 9): PostComment = postComments.saveAndFlush(
        PostComment(
            id = "vis-pc-${UUID.randomUUID()}",
            postId = postId,
            author = Author("작성자", false),
            text = "숨김 대상 댓글",
            time = "방금",
            seq = System.nanoTime(),
            authorUserId = authorUserId,
        ),
    )

    private fun saveCampaign(authorUserId: Long? = 9): Campaign = campaigns.saveAndFlush(
        Campaign(
            "vis-camp-${UUID.randomUUID()}", "open", "숨김 대상 캠페인", "요약", "",
            "2026-07-01", "2026-07-31", "2026-08-01", "2026-08-31",
            10, 0, "모집중", Author("작성자", false),
            CampaignBody("소개", emptyList(), emptyList()),
            seq = System.nanoTime(),
            authorUserId = authorUserId,
        ),
    )

    private fun setVisibility(targetType: String, targetId: String, hidden: Boolean, reason: String? = null, bearer: String? = adminToken) =
        mvc.patch("/api/admin/content/$targetType/$targetId") {
            if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(SetContentVisibilityRequest(hidden, reason))
        }

    @Test
    fun `숨김 복구 API는 비로그인 401 일반 사용자 403`() {
        val post = savePost()
        setVisibility("POST", post.id, true, bearer = null).andExpect { status { isUnauthorized() } }
        setVisibility("POST", post.id, true, bearer = otherToken).andExpect { status { isForbidden() } }
    }

    @Test
    fun `게시글 숨김은 공개 목록 검색 sitemap 상세에서 제외하고 작성자 상세만 허용한다`() {
        val post = savePost()
        setVisibility("POST", post.id, true, reason = "광고 게시글").andExpect {
            status { isOk() }
            jsonPath("$.hidden") { value(true) }
        }

        mvc.get("/api/posts").andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '${post.id}')]") { isEmpty() }
        }
        mvc.get("/api/posts/search?q=숨김 대상 게시글").andExpect {
            status { isOk() }
            jsonPath("$.content[?(@.id == '${post.id}')]") { isEmpty() }
        }
        mvc.get("/api/posts/sitemap-ids?page=0&size=500").andExpect {
            status { isOk() }
            jsonPath("$.ids[?(@ == '${post.id}')]") { isEmpty() }
        }
        // 비로그인·타인 → 404, 작성자 → 200 + hidden 플래그
        mvc.get("/api/posts/${post.id}").andExpect { status { isNotFound() } }
        mvc.get("/api/posts/${post.id}") {
            headers { add("Authorization", "Bearer $otherToken") }
        }.andExpect { status { isNotFound() } }
        mvc.get("/api/posts/${post.id}") {
            headers { add("Authorization", "Bearer $authorToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.hidden") { value(true) }
        }
        // 작성자 본인 목록(mine)에는 남는다
        mvc.get("/api/posts/mine") {
            headers { add("Authorization", "Bearer $authorToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '${post.id}')].hidden") { value(true) }
        }
    }

    @Test
    fun `숨김 게시글은 좋아요 북마크 댓글 작성이 404다`() {
        val post = savePost()
        setVisibility("POST", post.id, true).andExpect { status { isOk() } }

        mvc.post("/api/posts/${post.id}/like") {
            headers { add("Authorization", "Bearer $otherToken") }
        }.andExpect { status { isNotFound() } }
        mvc.post("/api/posts/${post.id}/bookmark") {
            headers { add("Authorization", "Bearer $otherToken") }
        }.andExpect { status { isNotFound() } }
        mvc.post("/api/posts/${post.id}/comments") {
            headers { add("Authorization", "Bearer $otherToken") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"댓글"}"""
        }.andExpect { status { isNotFound() } }
    }

    @Test
    fun `게시글 복구는 공개 노출을 되살리고 작성자에게 두 번 알린다`() {
        val post = savePost()
        val before = notifications.count()
        setVisibility("POST", post.id, true, reason = "정책 위반").andExpect { status { isOk() } }
        setVisibility("POST", post.id, false).andExpect {
            status { isOk() }
            jsonPath("$.hidden") { value(false) }
        }

        mvc.get("/api/posts/${post.id}").andExpect { status { isOk() } }
        assertThat(notifications.count()).isEqualTo(before + 2)
        val types = notifications.findAll().takeLast(2).map { it.type }
        assertThat(types).containsExactlyInAnyOrder(NotificationType.CONTENT_HIDDEN, NotificationType.CONTENT_RESTORED)
        assertThat(notifications.findAll().first { it.type == NotificationType.CONTENT_HIDDEN }.body).contains("정책 위반")
    }

    @Test
    fun `댓글 숨김은 목록에서 제외하고 카운터를 줄이며 복구와 삭제에서 이중 감소하지 않는다`() {
        val post = savePost(comments = 1)
        val comment = saveComment(post.id)

        setVisibility("POST_COMMENT", comment.id, true).andExpect { status { isOk() } }
        assertThat(posts.findById(post.id).orElseThrow().comments).isEqualTo(0)
        mvc.get("/api/posts/${post.id}/comments").andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '${comment.id}')]") { isEmpty() }
        }
        // 숨김 상태 재요청은 멱등(카운터 불변)
        setVisibility("POST_COMMENT", comment.id, true).andExpect { status { isOk() } }
        assertThat(posts.findById(post.id).orElseThrow().comments).isEqualTo(0)

        // 복구 → 카운터 원복 + 목록 복귀
        setVisibility("POST_COMMENT", comment.id, false).andExpect { status { isOk() } }
        assertThat(posts.findById(post.id).orElseThrow().comments).isEqualTo(1)
        mvc.get("/api/posts/${post.id}/comments").andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '${comment.id}')].text") { value("숨김 대상 댓글") }
        }

        // 다시 숨긴 뒤 작성자가 삭제해도 카운터가 음수로 이중 감소하지 않는다
        setVisibility("POST_COMMENT", comment.id, true).andExpect { status { isOk() } }
        mvc.delete("/api/posts/${post.id}/comments/${comment.id}") {
            headers { add("Authorization", "Bearer $authorToken") }
        }
        assertThat(posts.findById(post.id).orElseThrow().comments).isEqualTo(0)
    }

    @Test
    fun `캠페인 숨김은 목록 상세 참여를 차단하고 개설자 상세만 허용한다`() {
        val campaign = saveCampaign()
        setVisibility("CAMPAIGN", campaign.id, true).andExpect { status { isOk() } }

        mvc.get("/api/campaigns").andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '${campaign.id}')]") { isEmpty() }
        }
        mvc.get("/api/campaigns/${campaign.id}").andExpect { status { isNotFound() } }
        mvc.get("/api/campaigns/${campaign.id}") {
            headers { add("Authorization", "Bearer $authorToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.hidden") { value(true) }
        }
        mvc.post("/api/campaigns/${campaign.id}/join") {
            headers { add("Authorization", "Bearer $otherToken") }
        }.andExpect { status { isNotFound() } }
    }

    @Test
    fun `캠페인 댓글 숨김은 댓글 목록에서 제외된다`() {
        val campaign = saveCampaign()
        val comment = campaignComments.saveAndFlush(
            CampaignComment(
                id = "vis-cc-${UUID.randomUUID()}",
                campaignId = campaign.id,
                author = Author("작성자", false),
                text = "숨김 대상 캠페인 댓글",
                createdAt = Instant.parse("2026-07-01T00:00:00Z"),
                authorUserId = 9,
            ),
        )
        setVisibility("CAMPAIGN_COMMENT", comment.id, true).andExpect { status { isOk() } }
        mvc.get("/api/campaigns/${campaign.id}/comments").andExpect {
            status { isOk() }
            jsonPath("$.content[?(@.id == '${comment.id}')]") { isEmpty() }
        }
    }

    @Test
    fun `작성자가 삭제한 콘텐츠는 관리자도 복구할 수 없다`() {
        // soft delete 상태 재현: 삭제 시 deletedAt/hiddenAt 이 함께 마킹된다.
        val post = savePost(authorUserId = 9)
        post.deletedAt = java.time.Instant.now()
        post.hiddenAt = java.time.Instant.now()
        posts.saveAndFlush(post)

        // 복구는 404(삭제된 콘텐츠가 다시 공개되는 것을 막는다), 숨김 요청은 멱등 no-op.
        setVisibility("POST", post.id, false).andExpect { status { isNotFound() } }
        setVisibility("POST", post.id, true).andExpect { status { isOk() } }
        assertThat(posts.findById(post.id).get().deletedAt).isNotNull()
    }

    @Test
    fun `잘못된 대상 타입은 400 없는 대상은 404`() {
        setVisibility("WRONG", "any", true).andExpect { status { isBadRequest() } }
        setVisibility("POST", "missing-post", true).andExpect { status { isNotFound() } }
        setVisibility("POST", "missing-post", false).andExpect { status { isNotFound() } }
    }

    @Test
    fun `신고 조치 완료에 hideContent를 주면 콘텐츠가 함께 숨겨지고 미리보기에 반영된다`() {
        val post = savePost()
        val report = reports.saveAndFlush(
            Report(
                id = "vis-report-${UUID.randomUUID()}",
                reporterUserId = 2,
                targetType = "POST",
                targetId = post.id,
                reason = "SPAM",
                detail = null,
                time = "방금",
                seq = 1,
            ),
        )

        mvc.patch("/api/admin/reports/${report.id}") {
            headers { add("Authorization", "Bearer $adminToken") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(ResolveReportRequest("RESOLVED", "광고 확인", hideContent = true))
        }.andExpect {
            status { isOk() }
            jsonPath("$.status") { value("RESOLVED") }
            jsonPath("$.target.hidden") { value(true) }
        }

        assertThat(posts.findById(post.id).orElseThrow().hiddenAt).isNotNull()
        // 작성자에게 숨김 알림 + 신고자에게 처리 알림이 모두 생성된다
        val types = notifications.findAll().map { it.type }
        assertThat(types).contains(NotificationType.CONTENT_HIDDEN, NotificationType.REPORT_RESOLVED)
    }

    @Test
    fun `대상이 삭제된 신고도 hideContent 옵션과 무관하게 처리된다`() {
        val report = reports.saveAndFlush(
            Report(
                id = "vis-report-${UUID.randomUUID()}",
                reporterUserId = 2,
                targetType = "POST",
                targetId = "already-deleted-post",
                reason = "SPAM",
                detail = null,
                time = "방금",
                seq = 1,
            ),
        )
        mvc.patch("/api/admin/reports/${report.id}") {
            headers { add("Authorization", "Bearer $adminToken") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(ResolveReportRequest("RESOLVED", null, hideContent = true))
        }.andExpect {
            status { isOk() }
            jsonPath("$.status") { value("RESOLVED") }
            jsonPath("$.target") { value(null) }
        }
    }
}

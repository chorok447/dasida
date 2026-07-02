package com.dasida.api.mutation

import com.dasida.api.auth.User
import com.dasida.api.campaign.Campaign
import com.dasida.api.campaign.CampaignBody
import com.dasida.api.campaign.CampaignComment
import com.dasida.api.campaign.CampaignCommentRepository
import com.dasida.api.campaign.CampaignParticipantRepository
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.campaign.CreateCampaignCommentRequest
import com.dasida.api.campaign.FixedClockTestConfiguration
import com.dasida.api.post.Author
import com.dasida.api.post.CreateCommentRequest
import com.dasida.api.post.Post
import com.dasida.api.post.PostBookmark
import com.dasida.api.post.PostBookmarkRepository
import com.dasida.api.post.PostComment
import com.dasida.api.post.PostCommentRepository
import com.dasida.api.post.PostLike
import com.dasida.api.post.PostLikeRepository
import com.dasida.api.post.PostRepository
import com.dasida.api.report.CreateReportRequest
import com.dasida.api.report.ReportRepository
import com.dasida.api.security.JwtService
import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

/**
 * 실패한 mutation 이후 도메인 데이터 롤백/무변경 회귀 방지.
 *
 * 기존 ControllerTest·PR #75/#77/#83 은 실패 HTTP status 를, PR #84 는 알림 미생성을 고정한다.
 * 여기서는 mutation 이 validation·상태 충돌·참조 오류로 실패했을 때 댓글·신고·참여·좋아요/북마크 row 와
 * 집계·목록 API 관찰 결과가 변하지 않음만 대표 경로로 고정한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Import(FixedClockTestConfiguration::class)
class FailedMutationRollbackPolicyTest(
    @Autowired private val mvc: MockMvc,
    @Autowired private val jwt: JwtService,
    @Autowired private val mapper: ObjectMapper,
    @Autowired private val posts: PostRepository,
    @Autowired private val postComments: PostCommentRepository,
    @Autowired private val likes: PostLikeRepository,
    @Autowired private val bookmarks: PostBookmarkRepository,
    @Autowired private val campaigns: CampaignRepository,
    @Autowired private val campaignComments: CampaignCommentRepository,
    @Autowired private val participants: CampaignParticipantRepository,
    @Autowired private val reports: ReportRepository,
) {
    private val actor = 2L
    private val actorToken = jwt.issue(
        User(id = actor, email = "actor@test.com", passwordHash = "x", name = "행동한사람", verified = false),
    )

    private fun savePost(likes: Int = 0, comments: Int = 1, authorUserId: Long? = 1): String {
        val id = "fm-post-${UUID.randomUUID()}"
        posts.saveAndFlush(
            Post(
                id, Author("작성자", false), "방금", "본문", emptyList(), emptyList(), likes, comments,
                seq = System.nanoTime(), authorUserId = authorUserId,
            ),
        )
        return id
    }

    private fun savePostComment(
        postId: String,
        id: String = "fm-pc-${UUID.randomUUID()}",
        text: String = "기존 댓글",
        authorUserId: Long = 1,
    ): String {
        postComments.saveAndFlush(
            PostComment(
                id = id,
                postId = postId,
                author = Author("댓글작성자", false),
                text = text,
                time = "방금",
                seq = System.nanoTime(),
                authorUserId = authorUserId,
            ),
        )
        return id
    }

    private fun saveCampaign(
        status: String = "open",
        capacity: Int = 10,
        joined: Int = 0,
        authorUserId: Long? = 1,
    ): String {
        val id = "fm-camp-${UUID.randomUUID()}"
        campaigns.saveAndFlush(
            Campaign(
                id, status, "캠페인", "요약", "",
                "2026-07-01", "2026-07-31", "2026-08-01", "2026-08-31",
                capacity, joined, "모집중", Author("개설자", false),
                CampaignBody("소개", emptyList(), emptyList()),
                seq = System.nanoTime(), authorUserId = authorUserId,
            ),
        )
        return id
    }

    private fun saveCampaignComment(
        campaignId: String,
        id: String = "fm-cc-${UUID.randomUUID()}",
        text: String = "기존 캠페인 댓글",
        authorUserId: Long? = 9,
    ): String {
        campaignComments.saveAndFlush(
            CampaignComment(
                id = id,
                campaignId = campaignId,
                author = Author("댓글작성자", false),
                text = text,
                createdAt = Instant.parse("2026-07-01T00:00:00Z"),
                authorUserId = authorUserId,
            ),
        )
        return id
    }

    private fun saveReportTargetPost(): String {
        val postId = "fm-report-${UUID.randomUUID()}"
        posts.saveAndFlush(
            Post(
                postId, Author("작성자", false), "방금", "신고 대상", emptyList(), emptyList(), 0, 0,
                seq = System.nanoTime(), authorUserId = 9,
            ),
        )
        return postId
    }

    @Test
    fun `게시글 blank 댓글 작성 실패 후 기존 댓글과 집계와 목록이 변하지 않는다`() {
        val postId = savePost(comments = 1)
        val existingId = savePostComment(postId, text = "유지할 댓글")
        val beforeCount = postComments.countByPostId(postId)
        val beforeCommentsField = posts.findById(postId).orElseThrow().comments

        mvc.post("/api/posts/$postId/comments") {
            headers { add("Authorization", "Bearer $actorToken") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(CreateCommentRequest("   "))
        }.andExpect { status { isBadRequest() } }

        assertThat(postComments.countByPostId(postId)).isEqualTo(beforeCount)
        assertThat(posts.findById(postId).orElseThrow().comments).isEqualTo(beforeCommentsField)
        assertThat(postComments.findById(existingId).orElseThrow().text).isEqualTo("유지할 댓글")
        mvc.get("/api/posts/$postId/comments/page").andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(beforeCount) }
            jsonPath("$.content[0].id") { value(existingId) }
        }
        mvc.get("/api/posts/$postId").andExpect { jsonPath("$.comments") { value(beforeCommentsField) } }
    }

    @Test
    fun `존재하지 않는 게시글 댓글 작성 실패 후 댓글 row가 생기지 않는다`() {
        val controlPostId = savePost(comments = 0)
        val beforeCount = postComments.countByPostId(controlPostId)

        mvc.post("/api/posts/nope-${UUID.randomUUID()}/comments") {
            headers { add("Authorization", "Bearer $actorToken") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(CreateCommentRequest("댓글"))
        }.andExpect { status { isNotFound() } }

        assertThat(postComments.countByPostId(controlPostId)).isEqualTo(beforeCount)
    }

    @Test
    fun `캠페인 blank 댓글 작성 실패 후 기존 댓글 row가 유지된다`() {
        val campaignId = saveCampaign()
        val existingId = saveCampaignComment(campaignId, text = "남아야 할 댓글")
        val beforeCount = campaignComments.countByCampaignId(campaignId)

        mvc.post("/api/campaigns/$campaignId/comments") {
            headers { add("Authorization", "Bearer $actorToken") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(CreateCampaignCommentRequest("   "))
        }.andExpect { status { isBadRequest() } }

        assertThat(campaignComments.countByCampaignId(campaignId)).isEqualTo(beforeCount)
        assertThat(campaignComments.findById(existingId).orElseThrow().text).isEqualTo("남아야 할 댓글")
    }

    @Test
    fun `잘못된 신고 입력 실패 후 신고 row가 증가하지 않는다`() {
        val postId = saveReportTargetPost()
        val beforeCount = reports.count()

        mvc.post("/api/reports") {
            headers { add("Authorization", "Bearer $actorToken") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(CreateReportRequest("post", postId, "SPAM", null))
        }.andExpect { status { isBadRequest() } }
        mvc.post("/api/reports") {
            headers { add("Authorization", "Bearer $actorToken") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(CreateReportRequest("POST", postId, "UNKNOWN", null))
        }.andExpect { status { isBadRequest() } }
        mvc.post("/api/reports") {
            headers { add("Authorization", "Bearer $actorToken") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(CreateReportRequest("POST", " ", "SPAM", null))
        }.andExpect { status { isBadRequest() } }

        assertThat(reports.count()).isEqualTo(beforeCount)
    }

    @Test
    fun `존재하지 않는 대상 신고 실패 후 신고 row가 증가하지 않는다`() {
        val beforeCount = reports.count()

        mvc.post("/api/reports") {
            headers { add("Authorization", "Bearer $actorToken") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(
                CreateReportRequest("POST", "fm-missing-${UUID.randomUUID()}", "SPAM", null),
            )
        }.andExpect { status { isNotFound() } }

        assertThat(reports.count()).isEqualTo(beforeCount)
    }

    @Test
    fun `CAMPAIGN_COMMENT 중복 신고 실패 후 기존 신고 1건만 유지된다`() {
        val campaignId = saveCampaign()
        val commentId = saveCampaignComment(campaignId)

        mvc.post("/api/reports") {
            headers { add("Authorization", "Bearer $actorToken") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(CreateReportRequest("CAMPAIGN_COMMENT", commentId, "SPAM", null))
        }.andExpect { status { isCreated() } }

        mvc.post("/api/reports") {
            headers { add("Authorization", "Bearer $actorToken") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(CreateReportRequest("CAMPAIGN_COMMENT", commentId, "ABUSE", null))
        }.andExpect { status { isConflict() } }

        assertThat(
            reports.findAll().count {
                it.reporterUserId == actor && it.targetType == "CAMPAIGN_COMMENT" && it.targetId == commentId
            },
        ).isEqualTo(1)
    }

    @Test
    fun `정원 마감 캠페인 참여 실패 후 participant와 joined가 변하지 않는다`() {
        val campaignId = saveCampaign(capacity = 5, joined = 5)
        val beforeParticipants = participants.countByCampaignId(campaignId)
        val beforeJoined = campaigns.findById(campaignId).orElseThrow().joined

        mvc.post("/api/campaigns/$campaignId/join") {
            headers { add("Authorization", "Bearer $actorToken") }
        }.andExpect { status { isConflict() } }

        assertThat(participants.countByCampaignId(campaignId)).isEqualTo(beforeParticipants)
        assertThat(campaigns.findById(campaignId).orElseThrow().joined).isEqualTo(beforeJoined)
        mvc.get("/api/campaigns/$campaignId") {
            headers { add("Authorization", "Bearer $actorToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.joined") { value(beforeJoined) }
            jsonPath("$.joinedByMe") { value(false) }
        }
    }

    @Test
    fun `모집 중이 아닌 캠페인 참여 실패 후 participant와 joined가 변하지 않는다`() {
        val campaignId = saveCampaign(status = "closed", joined = 0)
        val beforeParticipants = participants.countByCampaignId(campaignId)
        val beforeJoined = campaigns.findById(campaignId).orElseThrow().joined

        mvc.post("/api/campaigns/$campaignId/join") {
            headers { add("Authorization", "Bearer $actorToken") }
        }.andExpect { status { is4xxClientError() } }

        assertThat(participants.countByCampaignId(campaignId)).isEqualTo(beforeParticipants)
        assertThat(campaigns.findById(campaignId).orElseThrow().joined).isEqualTo(beforeJoined)
        mvc.get("/api/campaigns/$campaignId") {
            headers { add("Authorization", "Bearer $actorToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.joinedByMe") { value(false) }
        }
    }

    @Test
    fun `없는 게시글 좋아요 실패 후 기존 게시글 like row와 likes 집계가 변하지 않는다`() {
        val postId = savePost(likes = 2)
        likes.saveAndFlush(PostLike("fm-like", postId, actor))
        val beforeLikes = posts.findById(postId).orElseThrow().likes
        val beforeLikeRows = likes.countByPostId(postId)

        mvc.post("/api/posts/nope-${UUID.randomUUID()}/like") {
            headers { add("Authorization", "Bearer $actorToken") }
        }.andExpect { status { isNotFound() } }

        assertThat(likes.countByPostId(postId)).isEqualTo(beforeLikeRows)
        assertThat(posts.findById(postId).orElseThrow().likes).isEqualTo(beforeLikes)
        mvc.get("/api/posts/$postId") {
            headers { add("Authorization", "Bearer $actorToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.likes") { value(beforeLikes) }
            jsonPath("$.likedByMe") { value(true) }
        }
    }

    @Test
    fun `없는 게시글 북마크 실패 후 기존 bookmark row가 변하지 않는다`() {
        val postId = savePost()
        bookmarks.saveAndFlush(PostBookmark("fm-bmk", postId, actor))
        val beforeBookmarkRows = bookmarks.countByPostId(postId)

        mvc.post("/api/posts/nope-${UUID.randomUUID()}/bookmark") {
            headers { add("Authorization", "Bearer $actorToken") }
        }.andExpect { status { isNotFound() } }

        assertThat(bookmarks.countByPostId(postId)).isEqualTo(beforeBookmarkRows)
        mvc.get("/api/posts/$postId") {
            headers { add("Authorization", "Bearer $actorToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.bookmarkedByMe") { value(true) }
        }
    }
}

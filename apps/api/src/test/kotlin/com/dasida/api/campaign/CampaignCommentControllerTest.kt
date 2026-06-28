package com.dasida.api.campaign

import com.dasida.api.auth.User
import com.dasida.api.post.Author
import com.dasida.api.security.JwtService
import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CampaignCommentControllerTest(
    @Autowired private val mvc: MockMvc,
    @Autowired private val jwt: JwtService,
    @Autowired private val mapper: ObjectMapper,
    @Autowired private val campaignRepo: CampaignRepository,
    @Autowired private val commentRepo: CampaignCommentRepository,
) {
    private val ownerToken = jwt.issue(
        User(id = 1, email = "comment@test.com", passwordHash = "x", name = "댓글 작성자", verified = true),
    )
    private val otherToken = jwt.issue(
        User(id = 2, email = "other-comment@test.com", passwordHash = "x", name = "다른 사용자", verified = false),
    )

    private fun saveCampaign(
        status: String = "upcoming",
        authorUserId: Long? = 1,
    ): String {
        val id = "comment-c-${UUID.randomUUID()}"
        campaignRepo.saveAndFlush(
            Campaign(
                id = id,
                status = status,
                title = "댓글 캠페인",
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
                seq = System.nanoTime(),
                authorUserId = authorUserId,
            ),
        )
        return id
    }

    private fun saveComment(
        campaignId: String,
        authorUserId: Long = 1,
        id: String = "cc-${UUID.randomUUID()}",
        text: String = "댓글 본문",
        createdAt: Instant = Instant.now(),
        authorName: String = "댓글 작성자",
        verified: Boolean = authorUserId == 1L,
    ): String {
        commentRepo.saveAndFlush(
            CampaignComment(
                id = id,
                campaignId = campaignId,
                author = Author(authorName, verified),
                text = text,
                createdAt = createdAt,
                authorUserId = authorUserId,
            ),
        )
        return id
    }

    private fun listComments(
        campaignId: String,
        page: Int = 0,
        size: Int = 20,
        bearer: String? = null,
    ) = mvc.get("/api/campaigns/$campaignId/comments") {
        param("page", page.toString())
        param("size", size.toString())
        if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
    }

    private fun createComment(
        campaignId: String,
        text: String,
        bearer: String? = ownerToken,
    ) = mvc.post("/api/campaigns/$campaignId/comments") {
        if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
        contentType = MediaType.APPLICATION_JSON
        content = mapper.writeValueAsString(CreateCampaignCommentRequest(text))
    }

    private fun deleteComment(
        campaignId: String,
        commentId: String,
        bearer: String? = ownerToken,
    ) = mvc.delete("/api/campaigns/$campaignId/comments/$commentId") {
        if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
    }

    @Test
    fun `없는 캠페인 댓글 목록은 404`() {
        listComments("missing").andExpect { status { isNotFound() } }
    }

    @Test
    fun `없는 캠페인 댓글 작성과 삭제는 404`() {
        createComment("missing", "댓글").andExpect { status { isNotFound() } }
        deleteComment("missing", "cc-missing").andExpect { status { isNotFound() } }
    }

    @Test
    fun `빈 댓글 목록은 pagination metadata와 함께 반환한다`() {
        val campaignId = saveCampaign()

        listComments(campaignId).andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(0) }
            jsonPath("$.page") { value(0) }
            jsonPath("$.size") { value(20) }
            jsonPath("$.totalElements") { value(0) }
            jsonPath("$.totalPages") { value(0) }
        }
    }

    @Test
    fun `공개 목록은 false이고 로그인 작성자는 자신의 댓글만 ownedByMe true`() {
        val campaignId = saveCampaign()
        val mine = saveComment(campaignId, authorUserId = 1)
        val other = saveComment(campaignId, authorUserId = 2)

        listComments(campaignId).andExpect {
            status { isOk() }
            jsonPath("$.content[*].ownedByMe") { value(Matchers.everyItem(Matchers.equalTo(false))) }
        }
        listComments(campaignId, bearer = ownerToken).andExpect {
            status { isOk() }
            jsonPath("$.content[?(@.id == '$mine')].ownedByMe") { value(Matchers.hasItem(true)) }
            jsonPath("$.content[?(@.id == '$other')].ownedByMe") { value(Matchers.hasItem(false)) }
        }
    }

    @Test
    fun `댓글은 최신순이고 동일 시각에는 id 오름차순`() {
        val campaignId = saveCampaign()
        val tiedAt = Instant.parse("2026-06-28T01:00:00Z")
        saveComment(campaignId, id = "cc-b", createdAt = tiedAt)
        saveComment(campaignId, id = "cc-a", createdAt = tiedAt)
        saveComment(campaignId, id = "cc-new", createdAt = tiedAt.plusSeconds(1))

        listComments(campaignId).andExpect {
            status { isOk() }
            jsonPath("$.content[*].id") { value(Matchers.contains("cc-new", "cc-a", "cc-b")) }
        }
    }

    @Test
    fun `page와 size를 적용하고 범위를 검증한다`() {
        val campaignId = saveCampaign()
        repeat(3) { index ->
            saveComment(campaignId, createdAt = Instant.parse("2026-06-28T01:00:0${index}Z"))
        }

        listComments(campaignId, page = 1, size = 2).andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(1) }
            jsonPath("$.page") { value(1) }
            jsonPath("$.size") { value(2) }
            jsonPath("$.totalElements") { value(3) }
            jsonPath("$.totalPages") { value(2) }
        }
        listComments(campaignId, page = -1).andExpect { status { isBadRequest() } }
        listComments(campaignId, size = 0).andExpect { status { isBadRequest() } }
        listComments(campaignId, size = 101).andExpect { status { isBadRequest() } }
        listComments(campaignId, size = 1).andExpect { status { isOk() } }
        listComments(campaignId, size = 100).andExpect { status { isOk() } }
    }

    @Test
    fun `비로그인 댓글 작성은 401`() {
        val campaignId = saveCampaign()
        createComment(campaignId, "작성 불가", bearer = null).andExpect { status { isUnauthorized() } }
        assertThat(commentRepo.countByCampaignId(campaignId)).isZero()
    }

    @Test
    fun `blank와 500자 초과 댓글 작성은 400`() {
        val campaignId = saveCampaign()
        createComment(campaignId, "   ").andExpect { status { isBadRequest() } }
        createComment(campaignId, "가".repeat(501)).andExpect { status { isBadRequest() } }
        assertThat(commentRepo.countByCampaignId(campaignId)).isZero()
    }

    @Test
    fun `정상 작성은 trim과 author snapshot을 저장하고 소유 상태를 반환한다`() {
        val campaignId = saveCampaign(status = "closed")
        val before = Instant.now()

        val result = createComment(campaignId, "  상태와 무관한 댓글  ").andExpect {
            status { isCreated() }
            jsonPath("$.id") { value(Matchers.startsWith("cc-")) }
            jsonPath("$.campaignId") { value(campaignId) }
            jsonPath("$.author.name") { value("댓글 작성자") }
            jsonPath("$.author.verified") { value(true) }
            jsonPath("$.text") { value("상태와 무관한 댓글") }
            jsonPath("$.createdAt") { exists() }
            jsonPath("$.ownedByMe") { value(true) }
            jsonPath("$.authorUserId") { doesNotExist() }
        }.andReturn()

        val id = mapper.readTree(result.response.contentAsString)["id"].asText()
        val saved = commentRepo.findById(id).orElseThrow()
        assertThat(saved.authorUserId).isEqualTo(1)
        assertThat(saved.author.name).isEqualTo("댓글 작성자")
        assertThat(saved.author.verified).isTrue()
        assertThat(saved.text).isEqualTo("상태와 무관한 댓글")
        assertThat(saved.createdAt).isAfterOrEqualTo(before)
    }

    @Test
    fun `작성자는 자신의 댓글을 삭제하면 204`() {
        val campaignId = saveCampaign()
        val commentId = saveComment(campaignId)

        deleteComment(campaignId, commentId).andExpect { status { isNoContent() } }
        assertThat(commentRepo.existsById(commentId)).isFalse()
    }

    @Test
    fun `비로그인 댓글 삭제는 401`() {
        val campaignId = saveCampaign()
        val commentId = saveComment(campaignId)

        deleteComment(campaignId, commentId, bearer = null).andExpect { status { isUnauthorized() } }
        assertThat(commentRepo.existsById(commentId)).isTrue()
    }

    @Test
    fun `다른 사용자의 댓글 삭제는 403이고 데이터를 유지한다`() {
        val campaignId = saveCampaign()
        val commentId = saveComment(campaignId)

        deleteComment(campaignId, commentId, bearer = otherToken).andExpect { status { isForbidden() } }
        assertThat(commentRepo.existsById(commentId)).isTrue()
    }

    @Test
    fun `다른 캠페인의 commentId와 없는 댓글은 404`() {
        val campaignId = saveCampaign()
        val otherCampaignId = saveCampaign()
        val commentId = saveComment(otherCampaignId)

        deleteComment(campaignId, commentId).andExpect { status { isNotFound() } }
        deleteComment(campaignId, "cc-missing").andExpect { status { isNotFound() } }
        assertThat(commentRepo.existsById(commentId)).isTrue()
    }

    @Test
    fun `같은 댓글을 반복 삭제하면 404`() {
        val campaignId = saveCampaign()
        val commentId = saveComment(campaignId)

        deleteComment(campaignId, commentId).andExpect { status { isNoContent() } }
        deleteComment(campaignId, commentId).andExpect { status { isNotFound() } }
    }

    @Test
    fun `캠페인 삭제 성공 시 해당 댓글을 함께 정리한다`() {
        val campaignId = saveCampaign(status = "upcoming", authorUserId = 1)
        val otherCampaignId = saveCampaign(status = "upcoming", authorUserId = 1)
        saveComment(campaignId)
        val otherComment = saveComment(otherCampaignId)

        mvc.delete("/api/campaigns/$campaignId") {
            headers { add("Authorization", "Bearer $ownerToken") }
        }.andExpect { status { isNoContent() } }

        assertThat(commentRepo.countByCampaignId(campaignId)).isZero()
        assertThat(commentRepo.existsById(otherComment)).isTrue()
    }
}

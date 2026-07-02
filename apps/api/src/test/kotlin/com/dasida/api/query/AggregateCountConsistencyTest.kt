package com.dasida.api.query

import com.dasida.api.auth.User
import com.dasida.api.campaign.Campaign
import com.dasida.api.campaign.CampaignBody
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * 집계 카운트의 목록/상세 일관성 회귀 방지.
 *
 * 게시글 `likes`/`comments`, 캠페인 `joined` 의 증감 자체는 각 ControllerTest 가 mutation 응답과 상세 조회에서
 * 이미 고정한다. 다만 **목록 조회가 상세와 같은 집계 값을 반환하는지**는 고정되지 않았다(기존 목록 단언은
 * joinedByMe 등 viewer boolean 만 검증). 목록과 상세가 서로 다른 매핑 경로를 타므로, 리팩터링 시 한쪽만
 * 갱신되는 회귀를 대표 케이스로 고정한다. (좋아요/댓글/참여 증감 정책 자체와 viewer scope 필드는
 * PostControllerTest·CampaignControllerTest·PR #78 이 이미 고정하므로 중복하지 않는다.)
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AggregateCountConsistencyTest(
    @Autowired private val mvc: MockMvc,
    @Autowired private val mapper: ObjectMapper,
    @Autowired private val jwt: JwtService,
    @Autowired private val posts: PostRepository,
    @Autowired private val campaigns: CampaignRepository,
) {
    private val token = jwt.issue(User(id = 1, email = "me@test.com", passwordHash = "x", name = "나"))

    private fun savePost(): String {
        val id = "agg-post-${UUID.randomUUID()}"
        posts.saveAndFlush(
            Post(
                id, Author("작성자", false), "방금", "본문", emptyList(), emptyList(), 0, 0,
                seq = 1, authorUserId = 9,
            ),
        )
        return id
    }

    private fun saveJoinableCampaign(): String {
        val id = "agg-camp-${UUID.randomUUID()}"
        campaigns.saveAndFlush(
            Campaign(
                id, "open", "캠페인", "요약", "",
                "2026-06-01", "2026-07-31", "2026-08-01", "2026-08-31",
                capacity = 10, joined = 0, daysLeftLabel = "모집중",
                author = Author("개설자", false),
                body = CampaignBody("소개", emptyList(), emptyList()),
                seq = 1, authorUserId = 9,
            ),
        )
        return id
    }

    private fun detailField(path: String, field: String): Int =
        mapper.readTree(mvc.get(path).andReturn().response.contentAsString)[field].asInt()

    /** 최상위 배열 목록에서 id 로 항목을 찾아 정수 필드를 읽는다. */
    private fun listField(listPath: String, id: String, field: String): Int {
        val body = mvc.get(listPath).andReturn().response.contentAsString
        val node = mapper.readTree(body).first { it["id"].asText() == id }
        return node[field].asInt()
    }

    @Test
    fun `게시글 좋아요와 댓글 수는 목록과 상세가 같은 값을 반환한다`() {
        val id = savePost()

        mvc.post("/api/posts/$id/like") {
            headers { add("Authorization", "Bearer $token") }
        }.andExpect { status { isOk() } }
        mvc.post("/api/posts/$id/comments") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"댓글"}"""
        }.andExpect { status { isCreated() } }

        val detailLikes = detailField("/api/posts/$id", "likes")
        val detailComments = detailField("/api/posts/$id", "comments")
        assertThat(detailLikes).isEqualTo(1)
        assertThat(detailComments).isEqualTo(1)
        assertThat(listField("/api/posts", id, "likes")).isEqualTo(detailLikes)
        assertThat(listField("/api/posts", id, "comments")).isEqualTo(detailComments)
    }

    @Test
    fun `캠페인 참여자 수는 목록과 상세가 같은 값을 반환한다`() {
        val id = saveJoinableCampaign()

        mvc.post("/api/campaigns/$id/join") {
            headers { add("Authorization", "Bearer $token") }
        }.andExpect { status { isOk() } }

        val detailJoined = detailField("/api/campaigns/$id", "joined")
        assertThat(detailJoined).isEqualTo(1)
        assertThat(listField("/api/campaigns", id, "joined")).isEqualTo(detailJoined)
    }
}

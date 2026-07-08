package com.dasida.api.post

import com.dasida.api.auth.User
import com.dasida.api.notification.NotificationRepository
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.data.domain.PageRequest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.json.JsonMapper
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PostCommentReplyTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val mapper: JsonMapper,
    @param:Autowired private val posts: PostRepository,
    @param:Autowired private val comments: PostCommentRepository,
    @param:Autowired private val notifications: NotificationRepository,
) {
    private val writerToken = jwt.issue(
        User(id = 1, email = "reply-writer@test.com", passwordHash = "x", name = "댓글러", verified = true),
    )
    private val replierToken = jwt.issue(
        User(id = 2, email = "reply-replier@test.com", passwordHash = "x", name = "답글러", verified = false),
    )

    private fun savePost(): String {
        val id = "reply-p-${UUID.randomUUID()}"
        posts.saveAndFlush(
            Post(
                id = id,
                author = Author("글쓴이", false),
                time = "방금",
                text = "본문",
                tags = emptyList(),
                images = emptyList(),
                likes = 0,
                comments = 0,
                authorUserId = 4,
            ),
        )
        return id
    }

    private fun createComment(postId: String, text: String, parentId: String? = null, bearer: String = writerToken) =
        mvc.post("/api/posts/$postId/comments") {
            headers { add("Authorization", "Bearer $bearer") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(CreateCommentRequest(text = text, parentId = parentId))
        }

    private fun idOf(responseBody: String): String = mapper.readTree(responseBody).get("id").asString()

    @Test
    fun `답글이 부모 아래에 중첩되고 카운트가 분리된다`() {
        val postId = savePost()
        val parentId = idOf(createComment(postId, "부모 댓글").andReturn().response.contentAsString)
        createComment(postId, "답글입니다", parentId = parentId, bearer = replierToken)
            .andExpect { status { isCreated() } }
            .andExpect { jsonPath("$.parentId", Matchers.`is`(parentId)) }

        mvc.get("/api/posts/$postId/comments/page")
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.totalElements", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.totalComments", Matchers.`is`(2)) }
            .andExpect { jsonPath("$.content[0].id", Matchers.`is`(parentId)) }
            .andExpect { jsonPath("$.content[0].replies.length()", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.content[0].replies[0].text", Matchers.`is`("답글입니다")) }

        // post.comments 카운터는 답글을 포함한다.
        assertThat(posts.findById(postId).orElseThrow().comments).isEqualTo(2)
    }

    @Test
    fun `답글의 답글은 400`() {
        val postId = savePost()
        val parentId = idOf(createComment(postId, "부모").andReturn().response.contentAsString)
        val replyId = idOf(
            createComment(postId, "답글", parentId = parentId).andReturn().response.contentAsString,
        )

        createComment(postId, "답글의 답글", parentId = replyId)
            .andExpect { status { isBadRequest() } }
    }

    @Test
    fun `부모 댓글 삭제 시 답글도 함께 soft delete 되고 카운터가 맞는다`() {
        val postId = savePost()
        val parentId = idOf(createComment(postId, "부모").andReturn().response.contentAsString)
        val replyId = idOf(
            createComment(postId, "답글", parentId = parentId, bearer = replierToken)
                .andReturn().response.contentAsString,
        )
        assertThat(posts.findById(postId).orElseThrow().comments).isEqualTo(2)

        mvc.delete("/api/posts/$postId/comments/$parentId") {
            headers { add("Authorization", "Bearer $writerToken") }
        }.andExpect { status { isNoContent() } }

        // soft delete: 답글 row 도 남지만 deletedAt/hiddenAt 마킹으로 목록에서 제외된다.
        val reply = comments.findById(replyId).orElseThrow()
        assertThat(reply.deletedAt).isNotNull()
        assertThat(reply.hiddenAt).isNotNull()
        assertThat(posts.findById(postId).orElseThrow().comments).isEqualTo(0)
    }

    @Test
    fun `답글은 부모 댓글 작성자에게 알림을 보낸다`() {
        val postId = savePost()
        val parentId = idOf(createComment(postId, "부모").andReturn().response.contentAsString)
        createComment(postId, "답글", parentId = parentId, bearer = replierToken)
            .andExpect { status { isCreated() } }

        val count = notifications.findByUserId(1L, PageRequest.of(0, 10))
            .content.count { it.type == "COMMENT_REPLY_CREATED" }
        assertThat(count).isEqualTo(1)
    }

    @Test
    fun `답글 딥링크 위치는 부모 댓글 페이지로 계산된다`() {
        val postId = savePost()
        val parentId = idOf(createComment(postId, "부모").andReturn().response.contentAsString)
        val replyId = idOf(
            createComment(postId, "답글", parentId = parentId).andReturn().response.contentAsString,
        )
        // 부모보다 최신인 최상위 댓글을 여러 개 만들어 부모를 다음 page 로 밀어낸다(같은 밀리초 seq 동률 방지를 위해 직접 저장).
        val parentSeq = comments.findById(parentId).orElseThrow().seq
        repeat(3) { index ->
            comments.saveAndFlush(
                PostComment(
                    id = "pc-${UUID.randomUUID()}",
                    postId = postId,
                    author = Author("이후댓글러", false),
                    text = "이후 댓글 $index",
                    time = "방금 전",
                    seq = parentSeq + 1000 + index,
                    authorUserId = 2,
                ),
            )
        }

        mvc.get("/api/posts/$postId/comments/$replyId/page") { param("size", "2") }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.commentId", Matchers.`is`(replyId)) }
            .andExpect { jsonPath("$.page", Matchers.`is`(1)) }
    }

    @Test
    fun `존재하지 않거나 다른 게시글의 부모로는 답글을 달 수 없다`() {
        val postId = savePost()
        val otherPostId = savePost()
        val otherParent = idOf(createComment(otherPostId, "다른 글 댓글").andReturn().response.contentAsString)

        createComment(postId, "답글", parentId = "pc-없음")
            .andExpect { status { isNotFound() } }
        createComment(postId, "답글", parentId = otherParent)
            .andExpect { status { isNotFound() } }
    }
}

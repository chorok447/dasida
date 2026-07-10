package com.dasida.api.post

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import com.dasida.api.notification.NotificationRepository
import com.dasida.api.notification.NotificationType
import com.dasida.api.security.JwtService
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.data.domain.PageRequest
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
class PostCommentLikeTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val jwt: JwtService,
    @param:Autowired val posts: PostRepository,
    @param:Autowired val comments: PostCommentRepository,
    @param:Autowired val users: UserRepository,
    @param:Autowired val notifications: NotificationRepository,
) {
    private fun saveUser(name: String): User =
        users.save(User(email = "u-${UUID.randomUUID()}@t.com", passwordHash = "x", name = name))

    private fun savePost(authorUserId: Long? = null): String {
        val id = "clt-post-${UUID.randomUUID()}"
        posts.save(Post(id, Author("작성자", false), "방금", "본문", emptyList(), emptyList(), 0, 0, authorUserId = authorUserId))
        return id
    }

    private fun saveComment(postId: String, authorUserId: Long?, hidden: Boolean = false): String {
        val id = "clt-c-${UUID.randomUUID()}"
        comments.save(
            PostComment(
                id = id,
                postId = postId,
                author = Author("댓글러", false),
                text = "댓글 본문",
                time = "방금",
                seq = System.currentTimeMillis(),
                authorUserId = authorUserId,
                hiddenAt = if (hidden) Instant.now() else null,
            ),
        )
        return id
    }

    @Test
    fun `좋아요는 idempotent 하게 증가하고 목록에 likes·likedByMe 로 반영된다`() {
        val author = saveUser("댓글작성자")
        val liker = saveUser("좋아요러")
        val likerToken = jwt.issue(liker)
        val postId = savePost()
        val commentId = saveComment(postId, requireNotNull(author.id))

        mvc.post("/api/posts/$postId/comments/$commentId/like") {
            header("Authorization", "Bearer $likerToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.likes", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.likedByMe", Matchers.`is`(true)) }

        // 중복 좋아요 → 그대로 1
        mvc.post("/api/posts/$postId/comments/$commentId/like") {
            header("Authorization", "Bearer $likerToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.likes", Matchers.`is`(1)) }

        mvc.get("/api/posts/$postId/comments/page?page=0&size=10") {
            header("Authorization", "Bearer $likerToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.content[0].likes", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.content[0].likedByMe", Matchers.`is`(true)) }

        // 비로그인 목록: 카운트는 보이고 likedByMe 는 false
        mvc.get("/api/posts/$postId/comments/page?page=0&size=10")
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.content[0].likes", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.content[0].likedByMe", Matchers.`is`(false)) }

        // 댓글 작성자에게 COMMENT_LIKED 알림
        val notis = notifications.findByUserId(requireNotNull(author.id), PageRequest.of(0, 10))
        assert(notis.content.any { it.type == NotificationType.COMMENT_LIKED })
    }

    @Test
    fun `좋아요 취소도 idempotent 하고 본인 댓글 좋아요는 알림을 만들지 않는다`() {
        val self = saveUser("본인")
        val token = jwt.issue(self)
        val postId = savePost()
        val commentId = saveComment(postId, requireNotNull(self.id))

        mvc.post("/api/posts/$postId/comments/$commentId/like") {
            header("Authorization", "Bearer $token")
        }.andExpect { status { isOk() } }

        // notify() 의 self-skip — 본인 댓글 좋아요는 알림 없음
        val notis = notifications.findByUserId(requireNotNull(self.id), PageRequest.of(0, 10))
        assert(notis.content.none { it.type == NotificationType.COMMENT_LIKED })

        mvc.delete("/api/posts/$postId/comments/$commentId/like") {
            header("Authorization", "Bearer $token")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.likes", Matchers.`is`(0)) }
            .andExpect { jsonPath("$.likedByMe", Matchers.`is`(false)) }

        // 취소 상태에서 재취소 → 그대로 200
        mvc.delete("/api/posts/$postId/comments/$commentId/like") {
            header("Authorization", "Bearer $token")
        }.andExpect { status { isOk() } }
    }

    @Test
    fun `숨김 댓글·없는 댓글 좋아요는 404, 비로그인은 401`() {
        val author = saveUser("댓글작성자")
        val liker = saveUser("좋아요러")
        val likerToken = jwt.issue(liker)
        val postId = savePost()
        val hiddenComment = saveComment(postId, requireNotNull(author.id), hidden = true)

        mvc.post("/api/posts/$postId/comments/$hiddenComment/like") {
            header("Authorization", "Bearer $likerToken")
        }.andExpect { status { isNotFound() } }

        mvc.post("/api/posts/$postId/comments/nope/like") {
            header("Authorization", "Bearer $likerToken")
        }.andExpect { status { isNotFound() } }

        val visible = saveComment(postId, requireNotNull(author.id))
        mvc.post("/api/posts/$postId/comments/$visible/like")
            .andExpect { status { isUnauthorized() } }
    }
}

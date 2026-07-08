package com.dasida.api.notification

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CommentMentionTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val jwt: JwtService,
    @param:Autowired val users: UserRepository,
    @param:Autowired val posts: PostRepository,
) {
    private fun newUser(name: String): User =
        users.saveAndFlush(User(email = "${UUID.randomUUID()}@t.com", passwordHash = "x", name = name))

    private fun savePost(authorUserId: Long?): String {
        val id = "mtp-${UUID.randomUUID()}"
        posts.save(
            Post(id, Author("작성자", false), "방금", "본문", emptyList(), emptyList(), 0, 0, seq = 0, authorUserId = authorUserId),
        )
        return id
    }

    private fun comment(postId: String, author: User, text: String) =
        mvc.post("/api/posts/$postId/comments") {
            headers { add("Authorization", "Bearer ${jwt.issue(author)}") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"$text"}"""
        }.andExpect { status { isCreated() } }

    private fun notificationsOf(user: User) =
        mvc.get("/api/notifications") {
            headers { add("Authorization", "Bearer ${jwt.issue(user)}") }
        }

    @Test
    fun `댓글의 @이름 멘션은 언급된 사용자에게 알림을 만든다`() {
        val postAuthor = newUser("글쓴이멘션1")
        val commenter = newUser("댓글러멘션1")
        val mentioned = newUser("멘션대상하나")
        val postId = savePost(postAuthor.id)

        comment(postId, commenter, "@멘션대상하나 이것 좀 봐주세요")

        notificationsOf(mentioned).andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].type") { value(NotificationType.COMMENT_MENTIONED) }
            jsonPath("$.content[0].href") { value(org.hamcrest.Matchers.startsWith("/posts/$postId?commentId=")) }
        }
    }

    @Test
    fun `조사가 붙어도 가장 긴 prefix 이름으로 해석한다`() {
        val commenter = newUser("댓글러멘션2")
        val mentioned = newUser("멘션대상둘")
        val postId = savePost(newUser("글쓴이멘션2").id)

        comment(postId, commenter, "@멘션대상둘님 감사합니다")

        notificationsOf(mentioned).andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].type") { value(NotificationType.COMMENT_MENTIONED) }
        }
    }

    @Test
    fun `동명이인 멘션은 모호하므로 알림을 만들지 않는다`() {
        val commenter = newUser("댓글러멘션3")
        val twinA = newUser("멘션동명이인")
        newUser("멘션동명이인")
        val postId = savePost(newUser("글쓴이멘션3").id)

        comment(postId, commenter, "@멘션동명이인 안녕하세요")

        notificationsOf(twinA).andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(0) }
        }
    }

    @Test
    fun `게시글 작성자 멘션은 댓글 알림과 중복되지 않는다`() {
        val postAuthor = newUser("글쓴이멘션4")
        val commenter = newUser("댓글러멘션4")
        val postId = savePost(postAuthor.id)

        comment(postId, commenter, "@글쓴이멘션4 댓글 남겨요")

        notificationsOf(postAuthor).andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].type") { value(NotificationType.POST_COMMENT_CREATED) }
        }
    }

    @Test
    fun `본인 멘션은 알림을 만들지 않는다`() {
        val commenter = newUser("셀프멘션러")
        val postId = savePost(newUser("글쓴이멘션5").id)

        comment(postId, commenter, "@셀프멘션러 메모")

        notificationsOf(commenter).andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(0) }
        }
    }

    @Test
    fun `멘션 토큰 파싱 - 중복 제거와 최대 개수 제한`() {
        assertThat(CommentMentionNotifier.mentionTokens("@김철수 @김철수 좋아요 @lee_01님"))
            .containsExactly("김철수", "lee_01님")
        assertThat(CommentMentionNotifier.mentionTokens("멘션 없음")).isEmpty()
        val many = (1..15).joinToString(" ") { "@사용자$it" }
        assertThat(CommentMentionNotifier.mentionTokens(many)).hasSize(10)
    }
}

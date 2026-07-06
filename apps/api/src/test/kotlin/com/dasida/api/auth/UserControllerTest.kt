package com.dasida.api.auth

import com.dasida.api.notification.NotificationRepository
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class UserControllerTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val jwt: JwtService,
    @param:Autowired val users: UserRepository,
    @param:Autowired val posts: PostRepository,
    @param:Autowired val follows: UserFollowRepository,
    @param:Autowired val notifications: NotificationRepository,
) {
    @Test
    fun `공개 프로필과 게시글 목록을 조회한다`() {
        val user = users.save(
            User(
                email = "pub-${UUID.randomUUID()}@t.com",
                passwordHash = "x",
                name = "공개유저",
                verified = true,
                profileImageUrl = "https://example.com/a.jpg",
            ),
        )
        val userId = requireNotNull(user.id)
        posts.save(
            Post(
                id = "up-${UUID.randomUUID()}",
                author = Author("공개유저", true),
                time = "방금",
                text = "공개 글",
                tags = emptyList(),
                images = emptyList(),
                likes = 0,
                comments = 0,
                authorUserId = userId,
            ),
        )

        mvc.get("/api/users/$userId")
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.name", Matchers.`is`("공개유저")) }
            .andExpect { jsonPath("$.postCount", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.followerCount", Matchers.`is`(0)) }
            .andExpect { jsonPath("$.email") { doesNotExist() } }

        mvc.get("/api/users/$userId/posts")
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.content.length()", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.content[0].authorId", Matchers.`is`(userId.toInt())) }
    }

    @Test
    fun `팔로우와 추천 크리에이터를 처리한다`() {
        val follower = users.save(User(email = "f-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "팔로워"))
        val author = users.save(User(email = "a-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "작성자"))
        val followerId = requireNotNull(follower.id)
        val authorId = requireNotNull(author.id)
        posts.save(
            Post(
                id = "fp-${UUID.randomUUID()}",
                author = Author("작성자", false),
                time = "방금",
                text = "인기 글",
                tags = emptyList(),
                images = emptyList(),
                likes = 10,
                comments = 0,
                authorUserId = authorId,
            ),
        )
        val token = jwt.issue(follower)

        mvc.post("/api/users/$authorId/follow") {
            header("Authorization", "Bearer $token")
            contentType = MediaType.APPLICATION_JSON
        }.andExpect { status { isNoContent() } }

        mvc.get("/api/users/$authorId") {
            header("Authorization", "Bearer $token")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.followerCount", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.followedByMe", Matchers.`is`(true)) }

        mvc.get("/api/users/recommended") {
            header("Authorization", "Bearer $token")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.items[*].id", Matchers.not(Matchers.hasItem(authorId.toInt()))) }

        mvc.delete("/api/users/$authorId/follow") {
            header("Authorization", "Bearer $token")
        }.andExpect { status { isNoContent() } }

        assert(!follows.existsByFollowerIdAndFolloweeId(followerId, authorId))
    }

    @Test
    fun `팔로우 시 수신자에게 알림이 생성된다`() {
        val follower = users.save(User(email = "nf-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "알림팔로워"))
        val author = users.save(User(email = "na-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "알림작성자"))
        val followerId = requireNotNull(follower.id)
        val authorId = requireNotNull(author.id)
        val token = jwt.issue(follower)

        mvc.post("/api/users/$authorId/follow") {
            header("Authorization", "Bearer $token")
            contentType = MediaType.APPLICATION_JSON
        }.andExpect { status { isNoContent() } }

        val count = notifications.findByUserId(authorId, org.springframework.data.domain.PageRequest.of(0, 10))
            .content.count { it.type == "USER_FOLLOWED" }
        org.junit.jupiter.api.Assertions.assertEquals(1, count)
    }

    @Test
    fun `차단 상태가 공개 프로필에 반영된다`() {
        val blocker = users.save(User(email = "bl-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "차단자"))
        val target = users.save(User(email = "bt-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "대상"))
        val blockerId = requireNotNull(blocker.id)
        val targetId = requireNotNull(target.id)
        val token = jwt.issue(blocker)

        mvc.get("/api/users/$targetId") {
            header("Authorization", "Bearer $token")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.blockedByMe", Matchers.`is`(false)) }

        mvc.post("/api/users/$targetId/block") {
            header("Authorization", "Bearer $token")
        }.andExpect { status { isNoContent() } }

        mvc.get("/api/users/$targetId") {
            header("Authorization", "Bearer $token")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.blockedByMe", Matchers.`is`(true)) }

        mvc.delete("/api/users/$targetId/block") {
            header("Authorization", "Bearer $token")
        }.andExpect { status { isNoContent() } }

        mvc.get("/api/users/$targetId") {
            header("Authorization", "Bearer $token")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.blockedByMe", Matchers.`is`(false)) }
    }

    @Test
    fun `없는 사용자는 404`() {
        mvc.get("/api/users/999999999")
            .andExpect { status { isNotFound() } }
    }
}

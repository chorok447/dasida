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

    @Test
    fun `사용자 검색은 이름 부분 일치로 찾고 탈퇴·정지 사용자를 제외한다`() {
        val tag = UUID.randomUUID().toString().take(8)
        val now = java.time.Instant.now()
        val active = users.save(User(email = "s1-$tag@t.com", passwordHash = "x", name = "활동-$tag"))
        users.save(User(email = "s2-$tag@t.com", passwordHash = "x", name = "탈퇴-$tag", deletedAt = now))
        users.save(
            User(
                email = "s3-$tag@t.com",
                passwordHash = "x",
                name = "정지-$tag",
                suspendedUntil = now.plusSeconds(3600),
            ),
        )
        val activeId = requireNotNull(active.id).toInt()

        mvc.get("/api/users/search") { param("q", tag) }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.totalElements", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.content[0].id", Matchers.`is`(activeId)) }
            .andExpect { jsonPath("$.content[0].name", Matchers.`is`("활동-$tag")) }
            .andExpect { jsonPath("$.content[0].email") { doesNotExist() } }
    }

    @Test
    fun `사용자 검색에서 빈 검색어는 빈 결과, 로그인 시 팔로우 상태를 포함한다`() {
        val tag = UUID.randomUUID().toString().take(8)
        val viewer = users.save(User(email = "sv-$tag@t.com", passwordHash = "x", name = "탐색자-$tag"))
        val target = users.save(User(email = "st-$tag@t.com", passwordHash = "x", name = "대상-$tag"))
        val token = jwt.issue(viewer)

        mvc.get("/api/users/search")
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.totalElements", Matchers.`is`(0)) }

        mvc.post("/api/users/${target.id}/follow") {
            header("Authorization", "Bearer $token")
        }.andExpect { status { isNoContent() } }

        mvc.get("/api/users/search") {
            param("q", "대상-$tag")
            header("Authorization", "Bearer $token")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.totalElements", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.content[0].followedByMe", Matchers.`is`(true)) }
    }

    @Test
    fun `사용자 검색어가 100자를 넘으면 400`() {
        mvc.get("/api/users/search") { param("q", "a".repeat(101)) }
            .andExpect { status { isBadRequest() } }
    }

    @Test
    fun `차단 목록은 최근 차단 순으로 반환하고 해제하면 빠진다`() {
        val me = users.save(User(email = "b-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "차단러"))
        val first = users.save(User(email = "t1-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "첫차단"))
        val second = users.save(User(email = "t2-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "둘째차단"))
        val token = jwt.issue(me)

        mvc.post("/api/users/${requireNotNull(first.id)}/block") {
            header("Authorization", "Bearer $token")
        }.andExpect { status { isNoContent() } }
        mvc.post("/api/users/${requireNotNull(second.id)}/block") {
            header("Authorization", "Bearer $token")
        }.andExpect { status { isNoContent() } }

        mvc.get("/api/users/me/blocked") {
            header("Authorization", "Bearer $token")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.totalElements", Matchers.`is`(2)) }
            .andExpect { jsonPath("$.content[0].name", Matchers.`is`("둘째차단")) }
            .andExpect { jsonPath("$.content[1].name", Matchers.`is`("첫차단")) }
            .andExpect { jsonPath("$.content[0].blockedByMe", Matchers.`is`(true)) }

        mvc.delete("/api/users/${requireNotNull(second.id)}/block") {
            header("Authorization", "Bearer $token")
        }.andExpect { status { isNoContent() } }

        mvc.get("/api/users/me/blocked") {
            header("Authorization", "Bearer $token")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.totalElements", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.content[0].name", Matchers.`is`("첫차단")) }

        // 비로그인은 401
        mvc.get("/api/users/me/blocked").andExpect { status { isUnauthorized() } }
    }
}

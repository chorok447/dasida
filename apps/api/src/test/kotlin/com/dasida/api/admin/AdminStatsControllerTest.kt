package com.dasida.api.admin

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import com.dasida.api.auth.UserRole
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import org.hamcrest.Matchers.greaterThanOrEqualTo
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminStatsControllerTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val users: UserRepository,
    @param:Autowired private val posts: PostRepository,
) {
    // user 4 를 관리자로 승격해 사용한다(@Transactional 이라 테스트 후 롤백).
    private val adminToken = jwt.issue(
        User(id = 4, email = "test-user-4@dasida.local", passwordHash = "x", name = "관리자"),
    )
    private val userToken = jwt.issue(
        User(id = 1, email = "test-user-1@dasida.local", passwordHash = "x", name = "일반 사용자"),
    )

    @BeforeEach
    fun promoteAdmin() {
        val admin = users.findById(4).orElseThrow()
        admin.role = UserRole.ADMIN.name
        users.saveAndFlush(admin)
    }

    @Test
    fun `관리자는 일별 통계를 조회할 수 있다`() {
        users.saveAndFlush(
            User(email = "stats-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "통계가입자", createdAt = Instant.now()),
        )
        posts.saveAndFlush(
            Post(
                id = "stats-post-${UUID.randomUUID()}",
                author = Author("작성자", false),
                time = "방금",
                text = "통계용 게시글",
                tags = emptyList(),
                images = emptyList(),
                likes = 0,
                comments = 0,
                seq = System.currentTimeMillis(),
                authorUserId = 1,
            ),
        )

        mvc.get("/api/admin/stats?days=7") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.days") { value(7) }
            jsonPath("$.daily.length()") { value(7) }
            // 마지막 요소가 오늘(KST) — 방금 만든 가입·게시글이 집계된다.
            jsonPath("$.daily[6].signups") { value(greaterThanOrEqualTo(1)) }
            jsonPath("$.daily[6].posts") { value(greaterThanOrEqualTo(1)) }
        }
    }

    @Test
    fun `허용 범위를 벗어난 days 는 400`() {
        mvc.get("/api/admin/stats?days=0") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect { status { isBadRequest() } }

        mvc.get("/api/admin/stats?days=91") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `일반 사용자는 통계를 조회할 수 없다`() {
        mvc.get("/api/admin/stats") {
            headers { add("Authorization", "Bearer $userToken") }
        }.andExpect { status { isForbidden() } }
    }
}

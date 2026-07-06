package com.dasida.api.auth

import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
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
            .andExpect { jsonPath("$.email") { doesNotExist() } }

        mvc.get("/api/users/$userId/posts")
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.content.length()", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.content[0].authorId", Matchers.`is`(userId.toInt())) }
    }

    @Test
    fun `없는 사용자는 404`() {
        mvc.get("/api/users/999999999")
            .andExpect { status { isNotFound() } }
    }
}

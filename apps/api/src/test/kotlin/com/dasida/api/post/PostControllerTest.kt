package com.dasida.api.post

import com.dasida.api.auth.User
import com.dasida.api.security.JwtService
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PostControllerTest(
    @Autowired val mvc: MockMvc,
    @Autowired val jwt: JwtService,
) {
    private val token = jwt.issue(User(id = 1, email = "t@t.com", passwordHash = "x", name = "테스터", verified = false))

    @Test
    fun `목록은 시드 전체를 반환한다`() {
        mvc.get("/api/posts").andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(PostSeed.posts.size) }
            jsonPath("$[0].id") { value("p1") }
        }
    }

    @Test
    fun `id로 단건을 반환한다`() {
        mvc.get("/api/posts/p1").andExpect {
            status { isOk() }
            jsonPath("$.campaignId") { value("c1") }
        }
    }

    @Test
    fun `없는 id는 404`() {
        mvc.get("/api/posts/nope").andExpect { status { isNotFound() } }
    }

    @Test
    fun `토큰 없이 생성하면 401`() {
        mvc.post("/api/posts") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"무명 글"}"""
        }.andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `토큰으로 생성하면 201과 함께 저장된다`() {
        mvc.post("/api/posts") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"새 업사이클 글","tags":["#테스트"],"images":[]}"""
        }.andExpect {
            status { isCreated() }
            jsonPath("$.id") { exists() }
            jsonPath("$.text") { value("새 업사이클 글") }
            jsonPath("$.author.name") { value("테스터") }
        }
    }

    @Test
    fun `빈 내용은 400`() {
        mvc.post("/api/posts") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"   "}"""
        }.andExpect { status { isBadRequest() } }
    }
}

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
    fun `깨진 토큰으로 생성하면 401`() {
        mvc.post("/api/posts") {
            headers { add("Authorization", "Bearer broken-token") }
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

    private fun postPost(body: String) = mvc.post("/api/posts") {
        headers { add("Authorization", "Bearer $token") }
        contentType = MediaType.APPLICATION_JSON
        content = body
    }

    @Test
    fun `text 는 trim 되어 저장된다`() {
        postPost("""{"text":"  새 업사이클 글  "}""").andExpect {
            status { isCreated() }
            jsonPath("$.text") { value("새 업사이클 글") }
        }
    }

    @Test
    fun `text 가 너무 길면 400`() {
        val long = "가".repeat(1001)
        postPost("""{"text":"$long"}""").andExpect { status { isBadRequest() } }
    }

    @Test
    fun `tags 는 trim 중복제거 hash prefix 처리되어 저장된다`() {
        postPost("""{"text":"태그","tags":[" 테스트 ","#테스트","업사이클"]}""").andExpect {
            status { isCreated() }
            jsonPath("$.tags.length()") { value(2) }
            jsonPath("$.tags[0]") { value("#테스트") }
            jsonPath("$.tags[1]") { value("#업사이클") }
        }
    }

    @Test
    fun `tags 가 너무 많으면 400`() {
        val many = (1..11).joinToString(",") { "\"#t$it\"" }
        postPost("""{"text":"많음","tags":[$many]}""").andExpect { status { isBadRequest() } }
    }

    @Test
    fun `tag 하나가 너무 길면 400`() {
        val longTag = "#" + "a".repeat(30) // 31자
        postPost("""{"text":"긺","tags":["$longTag"]}""").andExpect { status { isBadRequest() } }
    }

    @Test
    fun `images 는 blank 제거 trim 중복제거되어 저장된다`() {
        postPost(
            """{"text":"이미지","images":[" https://a.com/x ","https://a.com/x","","https://b.com/y"]}""",
        ).andExpect {
            status { isCreated() }
            jsonPath("$.images.length()") { value(2) }
            jsonPath("$.images[0]") { value("https://a.com/x") }
            jsonPath("$.images[1]") { value("https://b.com/y") }
        }
    }

    @Test
    fun `images 가 너무 많으면 400`() {
        val imgs = (1..5).joinToString(",") { "\"https://a.com/$it.png\"" }
        postPost("""{"text":"많음","images":[$imgs]}""").andExpect { status { isBadRequest() } }
    }

    @Test
    fun `image 가 http(s) URL 이 아니면 400`() {
        postPost("""{"text":"형식","images":["ftp://a.com/x.png"]}""").andExpect { status { isBadRequest() } }
    }

    @Test
    fun `존재하는 campaignId 는 201 로 저장된다`() {
        postPost("""{"text":"연결","campaignId":"c1"}""").andExpect {
            status { isCreated() }
            jsonPath("$.campaignId") { value("c1") }
        }
    }

    @Test
    fun `존재하지 않는 campaignId 는 400`() {
        postPost("""{"text":"없음","campaignId":"nope"}""").andExpect { status { isBadRequest() } }
    }

    @Test
    fun `blank campaignId 는 null 로 저장된다`() {
        postPost("""{"text":"공백","campaignId":"  "}""").andExpect {
            status { isCreated() }
            jsonPath("$.campaignId") { value(null) }
        }
    }
}

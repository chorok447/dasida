package com.dasida.api.campaign

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
class CampaignControllerTest(
    @Autowired val mvc: MockMvc,
    @Autowired val jwt: JwtService,
) {
    private val token = jwt.issue(User(id = 1, email = "t@t.com", passwordHash = "x", name = "테스터", verified = false))

    @Test
    fun `목록은 시드 전체를 반환한다`() {
        mvc.get("/api/campaigns").andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(CampaignSeed.campaigns.size) }
            jsonPath("$[0].id") { value("c1") }
        }
    }

    @Test
    fun `id로 단건을 반환한다`() {
        mvc.get("/api/campaigns/c2").andExpect {
            status { isOk() }
            jsonPath("$.title") { value("한강공원 플로깅 데이") }
        }
    }

    @Test
    fun `없는 id는 404`() {
        mvc.get("/api/campaigns/nope").andExpect { status { isNotFound() } }
    }

    @Test
    fun `토큰 없이 생성하면 401`() {
        mvc.post("/api/campaigns") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"title":"무명 캠페인"}"""
        }.andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `토큰으로 생성하면 201과 함께 저장된다`() {
        mvc.post("/api/campaigns") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"title":"새 플로깅 캠페인","summary":"줍깅","capacity":20}"""
        }.andExpect {
            status { isCreated() }
            jsonPath("$.id") { exists() }
            jsonPath("$.title") { value("새 플로깅 캠페인") }
            jsonPath("$.status") { value("upcoming") }
            jsonPath("$.joined") { value(0) }
            jsonPath("$.author.name") { value("테스터") }
        }
    }

    @Test
    fun `빈 제목은 400`() {
        mvc.post("/api/campaigns") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"title":"  "}"""
        }.andExpect { status { isBadRequest() } }
    }
}

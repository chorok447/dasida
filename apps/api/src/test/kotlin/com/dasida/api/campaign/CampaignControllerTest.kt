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

    // 검증을 통과하는 정상 payload(날짜/정원 포함).
    private fun validBody(title: String = "새 플로깅 캠페인", capacity: Int = 20) =
        """{"title":"$title","summary":"줍깅","capacity":$capacity,
           "recruitStart":"2026-07-01","recruitEnd":"2026-07-31",
           "runStart":"2026-08-05","runEnd":"2026-08-30"}"""

    private fun postCampaign(body: String) = mvc.post("/api/campaigns") {
        headers { add("Authorization", "Bearer $token") }
        contentType = MediaType.APPLICATION_JSON
        content = body
    }

    @Test
    fun `토큰으로 생성하면 201과 함께 저장된다`() {
        postCampaign(validBody()).andExpect {
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
        postCampaign(validBody(title = "  ")).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `제목은 trim 되어 저장된다`() {
        postCampaign(validBody(title = "  새 캠페인  ")).andExpect {
            status { isCreated() }
            jsonPath("$.title") { value("새 캠페인") }
        }
    }

    @Test
    fun `정원이 0이면 400`() {
        postCampaign(validBody(capacity = 0)).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `정원이 음수면 400`() {
        postCampaign(validBody(capacity = -5)).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `정원이 상한을 넘으면 400`() {
        postCampaign(validBody(capacity = 10001)).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `날짜 형식이 잘못되면 400`() {
        postCampaign(
            """{"title":"형식","capacity":10,"recruitStart":"2026/07/01",
               "recruitEnd":"2026-07-31","runStart":"2026-08-05","runEnd":"2026-08-30"}""",
        ).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `모집 시작이 종료보다 늦으면 400`() {
        postCampaign(
            """{"title":"순서","capacity":10,"recruitStart":"2026-07-31",
               "recruitEnd":"2026-07-01","runStart":"2026-08-05","runEnd":"2026-08-30"}""",
        ).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `진행 시작이 종료보다 늦으면 400`() {
        postCampaign(
            """{"title":"순서","capacity":10,"recruitStart":"2026-07-01",
               "recruitEnd":"2026-07-31","runStart":"2026-08-30","runEnd":"2026-08-05"}""",
        ).andExpect { status { isBadRequest() } }
    }
}

package com.dasida.api.campaign

import com.dasida.api.auth.User
import com.dasida.api.post.Author
import com.dasida.api.security.JwtService
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CampaignControllerTest(
    @Autowired val mvc: MockMvc,
    @Autowired val jwt: JwtService,
    @Autowired val campaignRepo: CampaignRepository,
    @Autowired val participantRepo: CampaignParticipantRepository,
) {
    private val token = jwt.issue(User(id = 1, email = "t@t.com", passwordHash = "x", name = "테스터", verified = false))

    // 시드 상태에 의존하지 않도록 테스트용 캠페인을 직접 저장.
    private fun saveCampaign(status: String = "open", capacity: Int = 10, joined: Int = 0, seq: Long = System.nanoTime()): String {
        val id = "itc-${UUID.randomUUID()}"
        campaignRepo.save(
            Campaign(
                id, status, "테스트 캠페인", "요약", "https://x/y.png",
                "2026-07-01", "2026-07-31", "2026-08-05", "2026-08-30",
                capacity, joined, "라벨", Author("개설자", false),
                CampaignBody("소개", emptyList(), emptyList()),
                seq = seq,
            ),
        )
        return id
    }

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

    // ---- 참여(join) ----

    private fun join(id: String) = mvc.post("/api/campaigns/$id/join") {
        headers { add("Authorization", "Bearer $token") }
    }

    @Test
    fun `참여는 인증 없으면 401`() {
        mvc.post("/api/campaigns/${saveCampaign()}/join").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `없는 campaign 참여는 404`() {
        join("nope").andExpect { status { isNotFound() } }
    }

    @Test
    fun `open 이 아닌 campaign 참여는 400`() {
        join(saveCampaign(status = "upcoming")).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `정상 참여는 joined 가 1 증가`() {
        join(saveCampaign(capacity = 10, joined = 0)).andExpect {
            status { isOk() }
            jsonPath("$.joined") { value(1) }
        }
    }

    @Test
    fun `같은 유저가 두 번 참여해도 중복 증가하지 않는다`() {
        val id = saveCampaign(capacity = 10, joined = 0)
        repeat(2) { join(id).andExpect { status { isOk() } } }
        mvc.get("/api/campaigns/$id").andExpect { jsonPath("$.joined") { value(1) } }
    }

    @Test
    fun `정원이 꽉 찬 campaign 참여는 409`() {
        join(saveCampaign(capacity = 5, joined = 5)).andExpect { status { isConflict() } }
    }

    @Test
    fun `이미 참여 row 가 있으면 join 은 idempotent 하게 200이고 중복 증가하지 않는다`() {
        val id = saveCampaign(capacity = 10, joined = 2)
        participantRepo.saveAndFlush(CampaignParticipant("cp-pre", id, 1)) // 토큰 유저 id=1 이 이미 참여
        join(id).andExpect {
            status { isOk() }
            jsonPath("$.joined") { value(2) }
        }
    }

    // ---- joinedByMe ----

    @Test
    fun `비로그인 단건은 joinedByMe false`() {
        mvc.get("/api/campaigns/${saveCampaign()}").andExpect {
            status { isOk() }
            jsonPath("$.joinedByMe") { value(false) }
        }
    }

    @Test
    fun `내가 참여한 campaign 은 joinedByMe true`() {
        val id = saveCampaign()
        participantRepo.saveAndFlush(CampaignParticipant("cp-me", id, 1))
        mvc.get("/api/campaigns/$id") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.joinedByMe") { value(true) }
        }
    }

    @Test
    fun `참여하지 않은 campaign 은 로그인해도 joinedByMe false`() {
        mvc.get("/api/campaigns/${saveCampaign()}") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            jsonPath("$.joinedByMe") { value(false) }
        }
    }

    @Test
    fun `join 응답은 joinedByMe true`() {
        join(saveCampaign(capacity = 10, joined = 0)).andExpect {
            status { isOk() }
            jsonPath("$.joinedByMe") { value(true) }
        }
    }

    @Test
    fun `list 에서 내가 참여한 campaign 만 joinedByMe true`() {
        val id = saveCampaign()
        participantRepo.saveAndFlush(CampaignParticipant("cp-list", id, 1))
        mvc.get("/api/campaigns") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$id')].joinedByMe") { value(Matchers.hasItem(true)) }
        }
    }

    // ---- 참여 캠페인 목록(joined) ----

    private val otherToken = jwt.issue(User(id = 2, email = "o@t.com", passwordHash = "x", name = "다른유저", verified = false))

    @Test
    fun `비로그인 GET joined는 401`() {
        mvc.get("/api/campaigns/joined").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `참여 내역 없으면 빈 배열`() {
        mvc.get("/api/campaigns/joined") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(0) }
        }
    }

    @Test
    fun `현재 사용자가 참여한 캠페인만 반환`() {
        val id1 = saveCampaign(seq = 100)
        @Suppress("UNUSED_VARIABLE") val id2 = saveCampaign(seq = 200) // 참여하지 않은 캠페인
        participantRepo.saveAndFlush(CampaignParticipant("cp-j1", id1, 1))
        // id2 는 참여하지 않음

        mvc.get("/api/campaigns/joined") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(1) }
            jsonPath("$[0].id") { value(id1) }
        }
    }

    @Test
    fun `다른 사용자의 참여 캠페인은 제외`() {
        val id = saveCampaign(seq = 100)
        participantRepo.saveAndFlush(CampaignParticipant("cp-j-other", id, 2)) // 다른 유저(id=2)

        mvc.get("/api/campaigns/joined") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(0) }
        }
    }

    @Test
    fun `여러 캠페인은 seq DESC로 정렬`() {
        val id1 = saveCampaign(seq = 100) // 오래된 것
        val id2 = saveCampaign(seq = 300) // 최신
        val id3 = saveCampaign(seq = 200) // 중간
        participantRepo.saveAndFlush(CampaignParticipant("cp-s1", id1, 1))
        participantRepo.saveAndFlush(CampaignParticipant("cp-s2", id2, 1))
        participantRepo.saveAndFlush(CampaignParticipant("cp-s3", id3, 1))

        mvc.get("/api/campaigns/joined") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(3) }
            jsonPath("$[0].id") { value(id2) }
            jsonPath("$[1].id") { value(id3) }
            jsonPath("$[2].id") { value(id1) }
        }
    }

    @Test
    fun `모든 결과의 joinedByMe가 true`() {
        val id = saveCampaign(seq = 100)
        participantRepo.saveAndFlush(CampaignParticipant("cp-jbm", id, 1))

        mvc.get("/api/campaigns/joined") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[0].joinedByMe") { value(true) }
        }
    }

    @Test
    fun `같은 캠페인에 반복 join해도 목록에는 한 번만 반환`() {
        val id = saveCampaign(seq = 100, capacity = 10, joined = 0)
        // join API로 두 번 참여 (idempotent)
        repeat(2) { join(id).andExpect { status { isOk() } } }

        mvc.get("/api/campaigns/joined") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(1) }
        }
    }

    @Test
    fun `삭제된 campaignId participant는 결과에서 제외`() {
        participantRepo.saveAndFlush(CampaignParticipant("cp-orphan", "no-such-campaign", 1))

        mvc.get("/api/campaigns/joined") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(0) }
        }
    }

    @Test
    fun `기존 public GET campaigns와 단건 조회는 정상 동작`() {
        val id = saveCampaign(seq = 100)
        mvc.get("/api/campaigns").andExpect { status { isOk() } }
        mvc.get("/api/campaigns/$id").andExpect {
            status { isOk() }
            jsonPath("$.id") { value(id) }
        }
    }
}

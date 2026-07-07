package com.dasida.api.campaign

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import com.dasida.api.notification.NotificationRepository
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Import(FixedClockTestConfiguration::class)
class CampaignControllerTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val jwt: JwtService,
    @param:Autowired val campaignRepo: CampaignRepository,
    @param:Autowired val participantRepo: CampaignParticipantRepository,
    @param:Autowired val bookmarkRepo: CampaignBookmarkRepository,
    @param:Autowired val postRepo: PostRepository,
    @param:Autowired val userRepo: UserRepository,
    @param:Autowired val notificationRepo: NotificationRepository,
) {
    private val token = jwt.issue(User(id = 1, email = "t@t.com", passwordHash = "x", name = "테스터", verified = false))
    private val otherToken = jwt.issue(User(id = 2, email = "o@t.com", passwordHash = "x", name = "다른유저", verified = false))

    // 시드 상태에 의존하지 않도록 테스트용 캠페인을 직접 저장.
    private fun saveCampaign(
        status: String = "open",
        capacity: Int = 10,
        joined: Int = 0,
        seq: Long = System.nanoTime(),
        authorUserId: Long? = null,
        authorName: String = "개설자",
        recruitStart: String = "2026-07-01",
        recruitEnd: String = "2026-07-31",
        runStart: String = "2026-08-05",
        runEnd: String = "2026-08-30",
    ): String {
        val id = "itc-${UUID.randomUUID()}"
        campaignRepo.save(
            Campaign(
                id, status, "테스트 캠페인", "요약", "https://x/y.png",
                recruitStart, recruitEnd, runStart, runEnd,
                capacity, joined, "라벨", Author(authorName, false),
                CampaignBody("소개", emptyList(), emptyList()),
                seq = seq,
                authorUserId = authorUserId,
            ),
        )
        return id
    }

    private fun saveUser(name: String, verified: Boolean = false): User = userRepo.saveAndFlush(
        User(
            email = "participant-${UUID.randomUUID()}@test.com",
            passwordHash = "hash",
            name = name,
            verified = verified,
        ),
    )

    private fun saveParticipant(campaignId: String, userId: Long, id: String = "cp-${UUID.randomUUID()}"): String {
        participantRepo.saveAndFlush(CampaignParticipant(id, campaignId, userId))
        return id
    }

    private fun getParticipants(
        id: String,
        page: Int = 0,
        size: Int = 20,
        bearer: String? = token,
    ) = mvc.get("/api/campaigns/$id/participants") {
        if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
        param("page", page.toString())
        param("size", size.toString())
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
    fun `모집 시작 전 open 캠페인은 참여할 수 없다`() {
        val id = saveCampaign(recruitStart = "2026-07-16", recruitEnd = "2026-07-31")

        mvc.get("/api/campaigns/$id").andExpect {
            status { isOk() }
            jsonPath("$.recruitState") { value("before_recruit") }
            jsonPath("$.recruitable") { value(false) }
            jsonPath("$.daysLeftLabel") { value("모집 예정") }
        }
    }

    @Test
    fun `모집 시작일과 종료일 당일은 모집 중이다`() {
        val startDay = saveCampaign(recruitStart = "2026-07-15", recruitEnd = "2026-07-31")
        val endDay = saveCampaign(recruitStart = "2026-07-01", recruitEnd = "2026-07-15")

        listOf(startDay to "D-16", endDay to "오늘 마감").forEach { (id, label) ->
            mvc.get("/api/campaigns/$id").andExpect {
                status { isOk() }
                jsonPath("$.recruitState") { value("recruiting") }
                jsonPath("$.recruitable") { value(true) }
                jsonPath("$.daysLeftLabel") { value(label) }
            }
        }
    }

    @Test
    fun `모집 종료 다음 날이면 모집 종료 상태다`() {
        val id = saveCampaign(recruitStart = "2026-07-01", recruitEnd = "2026-07-14")

        mvc.get("/api/campaigns/$id").andExpect {
            status { isOk() }
            jsonPath("$.recruitState") { value("ended") }
            jsonPath("$.recruitable") { value(false) }
            jsonPath("$.daysLeftLabel") { value("모집완료") }
        }
    }

    @Test
    fun `closed 또는 정원 마감 캠페인은 참여할 수 없다`() {
        val closed = saveCampaign(status = "closed")
        val full = saveCampaign(status = "open", capacity = 2, joined = 2)

        mvc.get("/api/campaigns/$closed").andExpect {
            status { isOk() }
            jsonPath("$.recruitState") { value("closed") }
            jsonPath("$.recruitable") { value(false) }
        }
        mvc.get("/api/campaigns/$full").andExpect {
            status { isOk() }
            jsonPath("$.recruitState") { value("recruiting") }
            jsonPath("$.recruitable") { value(false) }
            jsonPath("$.daysLeftLabel") { value("모집완료") }
        }
    }

    @Test
    fun `없는 id는 404`() {
        mvc.get("/api/campaigns/nope").andExpect { status { isNotFound() } }
    }

    // ---- 개설자용 참가자 목록 ----

    @Test
    fun `참가자 목록은 인증 없으면 401`() {
        val id = saveCampaign(authorUserId = 1)
        getParticipants(id, bearer = null).andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `개설자는 참가자 목록을 조회할 수 있다`() {
        val id = saveCampaign(authorUserId = 1)
        getParticipants(id).andExpect {
            status { isOk() }
            jsonPath("$.campaignId") { value(id) }
            jsonPath("$.title") { value("테스트 캠페인") }
        }
    }

    @Test
    fun `다른 사용자는 참가자 목록을 조회할 수 없다`() {
        val id = saveCampaign(authorUserId = 1)
        getParticipants(id, bearer = otherToken).andExpect { status { isForbidden() } }
    }

    @Test
    fun `authorUserId가 null인 캠페인 참가자 목록은 403`() {
        val id = saveCampaign(authorUserId = null)
        getParticipants(id).andExpect { status { isForbidden() } }
    }

    @Test
    fun `없는 캠페인 참가자 목록은 404`() {
        getParticipants("nope").andExpect { status { isNotFound() } }
    }

    @Test
    fun `참가자가 없으면 빈 목록과 totalElements 0을 반환한다`() {
        val id = saveCampaign(authorUserId = 1)
        getParticipants(id).andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(0) }
            jsonPath("$.totalPages") { value(0) }
            jsonPath("$.participants.length()") { value(0) }
        }
    }

    @Test
    fun `참가자 이름과 인증 여부를 현재 사용자 정보로 반환한다`() {
        val id = saveCampaign(joined = 1, authorUserId = 1)
        val participant = saveUser("현재 이름", verified = true)
        val participantId = saveParticipant(id, requireNotNull(participant.id))

        getParticipants(id).andExpect {
            status { isOk() }
            jsonPath("$.participants[0].participantId") { value(participantId) }
            jsonPath("$.participants[0].name") { value("현재 이름") }
            jsonPath("$.participants[0].verified") { value(true) }
        }
    }

    @Test
    fun `참가자 응답에 이메일 비밀번호 해시 userId를 노출하지 않는다`() {
        val id = saveCampaign(joined = 1, authorUserId = 1)
        val participant = saveUser("개인정보 확인")
        saveParticipant(id, requireNotNull(participant.id))

        getParticipants(id).andExpect {
            status { isOk() }
            jsonPath("$.participants[0].email") { doesNotExist() }
            jsonPath("$.participants[0].passwordHash") { doesNotExist() }
            jsonPath("$.participants[0].userId") { doesNotExist() }
        }
    }

    @Test
    fun `참가자 목록에 page와 size가 적용된다`() {
        val id = saveCampaign(joined = 3, authorUserId = 1)
        val users = listOf(saveUser("첫째"), saveUser("둘째"), saveUser("셋째"))
        users.forEach { saveParticipant(id, requireNotNull(it.id)) }

        getParticipants(id, page = 1, size = 2).andExpect {
            status { isOk() }
            jsonPath("$.page") { value(1) }
            jsonPath("$.size") { value(2) }
            jsonPath("$.totalElements") { value(3) }
            jsonPath("$.totalPages") { value(2) }
            jsonPath("$.participants.length()") { value(1) }
            jsonPath("$.participants[0].name") { value("셋째") }
        }
    }

    @Test
    fun `참가자 목록은 userId 오름차순으로 결정적으로 정렬된다`() {
        val id = saveCampaign(joined = 3, authorUserId = 1)
        val first = saveUser("첫 번째")
        val second = saveUser("두 번째")
        val third = saveUser("세 번째")
        val firstParticipant = saveParticipant(id, requireNotNull(first.id))
        val secondParticipant = saveParticipant(id, requireNotNull(second.id))
        val thirdParticipant = saveParticipant(id, requireNotNull(third.id))

        getParticipants(id).andExpect {
            status { isOk() }
            jsonPath("$.participants[0].participantId") { value(firstParticipant) }
            jsonPath("$.participants[1].participantId") { value(secondParticipant) }
            jsonPath("$.participants[2].participantId") { value(thirdParticipant) }
        }
    }

    @Test
    fun `page가 음수면 400`() {
        val id = saveCampaign(authorUserId = 1)
        getParticipants(id, page = -1).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `size가 0이면 400`() {
        val id = saveCampaign(authorUserId = 1)
        getParticipants(id, size = 0).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `size가 100을 넘으면 400`() {
        val id = saveCampaign(authorUserId = 1)
        getParticipants(id, size = 101).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `join 후 참가자 목록에 나타난다`() {
        val id = saveCampaign(status = "open", joined = 0, authorUserId = 1)
        val participant = saveUser("새 참가자", verified = true)
        val participantToken = jwt.issue(participant)

        mvc.post("/api/campaigns/$id/join") {
            headers { add("Authorization", "Bearer $participantToken") }
        }.andExpect { status { isOk() } }

        getParticipants(id).andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.participants[0].name") { value("새 참가자") }
        }
    }

    @Test
    fun `leave 후 참가자 목록에서 사라진다`() {
        val id = saveCampaign(status = "open", joined = 0, authorUserId = 1)
        val participant = saveUser("취소 참가자")
        val participantToken = jwt.issue(participant)
        mvc.post("/api/campaigns/$id/join") {
            headers { add("Authorization", "Bearer $participantToken") }
        }.andExpect { status { isOk() } }

        mvc.delete("/api/campaigns/$id/join") {
            headers { add("Authorization", "Bearer $participantToken") }
        }.andExpect { status { isOk() } }

        getParticipants(id).andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(0) }
            jsonPath("$.participants.length()") { value(0) }
        }
    }

    @Test
    fun `개설자는 모든 모집 상태의 참가자 목록을 조회할 수 있다`() {
        listOf("upcoming", "open", "closed").forEach { campaignStatus ->
            val id = saveCampaign(status = campaignStatus, authorUserId = 1)
            getParticipants(id).andExpect {
                status { isOk() }
                jsonPath("$.status") { value(campaignStatus) }
            }
        }
    }

    @Test
    fun `다른 캠페인 참가자는 목록에 섞이지 않는다`() {
        val target = saveCampaign(joined = 1, authorUserId = 1)
        val other = saveCampaign(joined = 1, authorUserId = 1)
        val included = saveUser("대상 참가자")
        val excluded = saveUser("다른 캠페인 참가자")
        saveParticipant(target, requireNotNull(included.id))
        saveParticipant(other, requireNotNull(excluded.id))

        getParticipants(target).andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.participants[0].name") { value("대상 참가자") }
        }
    }

    @Test
    fun `사용자 row가 없는 참가자도 fallback으로 반환한다`() {
        val id = saveCampaign(joined = 1, authorUserId = 1)
        val participantId = saveParticipant(id, Long.MAX_VALUE)

        getParticipants(id).andExpect {
            status { isOk() }
            jsonPath("$.participants[0].participantId") { value(participantId) }
            jsonPath("$.participants[0].name") { value("탈퇴한 사용자") }
            jsonPath("$.participants[0].verified") { value(false) }
        }
    }

    @Test
    fun `일반 캠페인 상세 GET은 공개 정책을 유지한다`() {
        val id = saveCampaign(authorUserId = 1)
        mvc.get("/api/campaigns/$id").andExpect { status { isOk() } }
    }

    @Test
    fun `일반 캠페인 GET은 공개이고 참가자 GET만 인증이 필요하다`() {
        val id = saveCampaign(authorUserId = 1)
        mvc.get("/api/campaigns").andExpect { status { isOk() } }
        mvc.get("/api/campaigns/$id").andExpect { status { isOk() } }
        mvc.get("/api/campaigns/$id/participants").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `토큰 없이 생성하면 401`() {
        mvc.post("/api/campaigns") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"title":"무명 캠페인"}"""
        }.andExpect { status { isUnauthorized() } }
    }

    // 검증을 통과하는 정상 payload(날짜/정원 포함).
    private fun validBody(
        title: String = "새 플로깅 캠페인",
        capacity: Int = 20,
        recruitStart: String = "2026-07-01",
        recruitEnd: String = "2026-07-31",
        runStart: String = "2026-08-05",
        runEnd: String = "2026-08-30",
    ) =
        """{"title":"$title","summary":"줍깅","capacity":$capacity,
           "recruitStart":"$recruitStart","recruitEnd":"$recruitEnd",
           "runStart":"$runStart","runEnd":"$runEnd"}"""

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
            jsonPath("$.ownedByMe") { value(true) }
            jsonPath("$.recruitStart") { value("2026-07-01") }
            jsonPath("$.recruitEnd") { value("2026-07-31") }
            jsonPath("$.runStart") { value("2026-08-05") }
            jsonPath("$.runEnd") { value("2026-08-30") }
        }
    }

    @Test
    fun `점 표기와 공백이 있는 생성 날짜는 ISO 형식으로 정규화된다`() {
        val title = "날짜 정규화 ${UUID.randomUUID()}"
        postCampaign(
            validBody(
                title = title,
                recruitStart = " 2026.07.01 ",
                recruitEnd = " 2026.07.31 ",
                runStart = " 2026.08.05 ",
                runEnd = " 2026.08.30 ",
            ),
        ).andExpect {
            status { isCreated() }
            jsonPath("$.recruitStart") { value("2026-07-01") }
            jsonPath("$.recruitEnd") { value("2026-07-31") }
            jsonPath("$.runStart") { value("2026-08-05") }
            jsonPath("$.runEnd") { value("2026-08-30") }
        }

        val saved = campaignRepo.findAll().single { it.title == title }
        assertThat(saved.recruitStart).isEqualTo("2026-07-01")
        assertThat(saved.recruitEnd).isEqualTo("2026-07-31")
        assertThat(saved.runStart).isEqualTo("2026-08-05")
        assertThat(saved.runEnd).isEqualTo("2026-08-30")
    }

    @Test
    fun `생성된 캠페인에 사용자 ID가 저장된다`() {
        postCampaign(validBody(title = "소유자 저장 검증")).andExpect { status { isCreated() } }

        val saved = campaignRepo.findAll().single { it.title == "소유자 저장 검증" }
        assertThat(saved.authorUserId).isEqualTo(1)
    }

    @Test
    fun `캠페인 응답에 authorUserId는 노출되지 않는다`() {
        postCampaign(validBody(title = "소유자 미노출 검증")).andExpect {
            status { isCreated() }
            jsonPath("$.authorUserId") { doesNotExist() }
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
    fun `존재하지 않거나 빈 생성 날짜는 400`() {
        listOf("2026-02-30", "   ").forEach { recruitStart ->
            postCampaign(validBody(recruitStart = recruitStart)).andExpect { status { isBadRequest() } }
        }
    }

    @Test
    fun `모집 시작이 종료보다 늦으면 400`() {
        postCampaign(
            """{"title":"순서","capacity":10,"recruitStart":"2026-07-31",
               "recruitEnd":"2026-07-01","runStart":"2026-08-05","runEnd":"2026-08-30"}""",
        ).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `모집 종료가 진행 시작보다 늦으면 400`() {
        postCampaign(
            validBody(recruitEnd = "2026-08-06", runStart = "2026-08-05"),
        ).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `진행 시작이 종료보다 늦으면 400`() {
        postCampaign(
            """{"title":"순서","capacity":10,"recruitStart":"2026-07-01",
               "recruitEnd":"2026-07-31","runStart":"2026-08-30","runEnd":"2026-08-05"}""",
        ).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `생성 날짜의 같은 날짜 경계는 허용한다`() {
        postCampaign(
            validBody(
                recruitStart = "2026-07-01",
                recruitEnd = "2026-07-01",
                runStart = "2026-07-01",
                runEnd = "2026-07-01",
            ),
        ).andExpect {
            status { isCreated() }
            jsonPath("$.runEnd") { value("2026-07-01") }
        }
    }

    @Test
    fun `상세 응답의 지원 가능한 legacy 날짜는 ISO 형식이다`() {
        val id = saveCampaign(
            recruitStart = "2026.07.01",
            recruitEnd = "2026.07.31",
            runStart = "2026.08.05",
            runEnd = "2026.08.30",
        )

        mvc.get("/api/campaigns/$id").andExpect {
            status { isOk() }
            jsonPath("$.recruitStart") { value("2026-07-01") }
            jsonPath("$.recruitEnd") { value("2026-07-31") }
            jsonPath("$.runStart") { value("2026-08-05") }
            jsonPath("$.runEnd") { value("2026-08-30") }
        }
    }

    // ---- 캠페인 수정 ----

    private fun validUpdateBody(
        title: String = "수정 캠페인",
        summary: String = "수정 요약",
        body: String = "수정 본문",
        thumb: String = "https://x/updated.png",
        recruitStart: String = "2026-09-01",
        recruitEnd: String = "2026-09-30",
        runStart: String = "2026-10-05",
        runEnd: String = "2026-10-31",
        capacity: Int = 30,
    ) = """{"title":"$title","summary":"$summary","body":"$body","thumb":"$thumb",
        "recruitStart":"$recruitStart","recruitEnd":"$recruitEnd",
        "runStart":"$runStart","runEnd":"$runEnd","capacity":$capacity}"""

    private fun updateCampaign(id: String, body: String = validUpdateBody(), bearer: String? = token) =
        mvc.put("/api/campaigns/$id") {
            if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
            contentType = MediaType.APPLICATION_JSON
            content = body
        }

    @Test
    fun `캠페인 수정은 인증 없으면 401`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        updateCampaign(id, bearer = null).andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `개설자는 upcoming 캠페인을 수정할 수 있고 DB에 저장된다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)

        updateCampaign(id).andExpect {
            status { isOk() }
            jsonPath("$.title") { value("수정 캠페인") }
            jsonPath("$.summary") { value("수정 요약") }
            jsonPath("$.thumb") { value("https://x/updated.png") }
            jsonPath("$.recruitStart") { value("2026-09-01") }
            jsonPath("$.recruitEnd") { value("2026-09-30") }
            jsonPath("$.runStart") { value("2026-10-05") }
            jsonPath("$.runEnd") { value("2026-10-31") }
            jsonPath("$.capacity") { value(30) }
            jsonPath("$.body.paragraphs[0]") { value("수정 본문") }
        }

        val saved = campaignRepo.findById(id).get()
        assertThat(saved.title).isEqualTo("수정 캠페인")
        assertThat(saved.summary).isEqualTo("수정 요약")
        assertThat(saved.body.paragraphs).containsExactly("수정 본문")
        assertThat(saved.capacity).isEqualTo(30)
    }

    @Test
    fun `점 표기 수정 날짜는 ISO 형식으로 정규화된다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)

        updateCampaign(
            id,
            validUpdateBody(
                recruitStart = " 2026.09.01 ",
                recruitEnd = " 2026.09.30 ",
                runStart = " 2026.10.05 ",
                runEnd = " 2026.10.31 ",
            ),
        ).andExpect {
            status { isOk() }
            jsonPath("$.recruitStart") { value("2026-09-01") }
            jsonPath("$.recruitEnd") { value("2026-09-30") }
            jsonPath("$.runStart") { value("2026-10-05") }
            jsonPath("$.runEnd") { value("2026-10-31") }
        }

        assertThat(campaignRepo.findById(id).get().recruitEnd).isEqualTo("2026-09-30")
    }

    @Test
    fun `다른 사용자는 캠페인을 수정할 수 없다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        updateCampaign(id, bearer = otherToken).andExpect { status { isForbidden() } }
    }

    @Test
    fun `authorUserId가 null인 캠페인은 수정할 수 없다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = null)
        updateCampaign(id).andExpect { status { isForbidden() } }
    }

    @Test
    fun `없는 캠페인 수정은 404`() {
        updateCampaign("nope").andExpect { status { isNotFound() } }
    }

    @Test
    fun `open 캠페인 수정은 409`() {
        val id = saveCampaign(status = "open", authorUserId = 1)
        updateCampaign(id).andExpect { status { isConflict() } }
    }

    @Test
    fun `closed 캠페인 수정은 409`() {
        val id = saveCampaign(status = "closed", authorUserId = 1)
        updateCampaign(id).andExpect { status { isConflict() } }
    }

    @Test
    fun `수정 제목은 trim 되어 저장된다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        updateCampaign(id, validUpdateBody(title = "  제목 정규화  ")).andExpect {
            status { isOk() }
            jsonPath("$.title") { value("제목 정규화") }
        }
    }

    @Test
    fun `수정 제목이 blank면 400`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        updateCampaign(id, validUpdateBody(title = "  ")).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `수정 정원이 0이거나 음수면 400`() {
        listOf(0, -1).forEach { capacity ->
            val id = saveCampaign(status = "upcoming", authorUserId = 1)
            updateCampaign(id, validUpdateBody(capacity = capacity)).andExpect { status { isBadRequest() } }
        }
    }

    @Test
    fun `수정 정원이 상한을 넘으면 400`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        updateCampaign(id, validUpdateBody(capacity = 10001)).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `수정 날짜 형식이 잘못되면 400`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        updateCampaign(id, validUpdateBody(recruitStart = "2026/09/01")).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `수정 날짜 검증 실패 시 기존 날짜를 유지한다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)

        updateCampaign(id, validUpdateBody(recruitStart = "2026-02-30"))
            .andExpect { status { isBadRequest() } }

        val saved = campaignRepo.findById(id).get()
        assertThat(saved.recruitStart).isEqualTo("2026-07-01")
        assertThat(saved.recruitEnd).isEqualTo("2026-07-31")
        assertThat(saved.runStart).isEqualTo("2026-08-05")
        assertThat(saved.runEnd).isEqualTo("2026-08-30")
    }

    @Test
    fun `수정 모집 시작일이 종료일보다 늦으면 400`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        updateCampaign(
            id,
            validUpdateBody(recruitStart = "2026-09-30", recruitEnd = "2026-09-01"),
        ).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `수정 모집 종료일이 진행 시작일보다 늦으면 400`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        updateCampaign(
            id,
            validUpdateBody(recruitEnd = "2026-10-06", runStart = "2026-10-05"),
        ).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `수정 진행 시작일이 종료일보다 늦으면 400`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        updateCampaign(
            id,
            validUpdateBody(runStart = "2026-10-31", runEnd = "2026-10-05"),
        ).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `수정 요약 본문 썸네일은 trim 되어 저장된다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        updateCampaign(
            id,
            validUpdateBody(summary = "  요약  ", body = "  본문  ", thumb = "  https://x/trim.png  "),
        ).andExpect {
            status { isOk() }
            jsonPath("$.summary") { value("요약") }
            jsonPath("$.body.paragraphs[0]") { value("본문") }
            jsonPath("$.thumb") { value("https://x/trim.png") }
        }
    }

    @Test
    fun `수정해도 불변 필드는 유지된다`() {
        val id = saveCampaign(
            status = "upcoming",
            joined = 2,
            seq = 12345,
            authorUserId = 1,
            authorName = "원래 작성자",
        )
        val before = campaignRepo.findById(id).get()
        val originalStatus = before.status
        val originalJoined = before.joined
        val originalDaysLeftLabel = before.daysLeftLabel
        val originalAuthor = before.author
        val originalAuthorUserId = before.authorUserId
        val originalSeq = before.seq

        updateCampaign(id).andExpect { status { isOk() } }

        val saved = campaignRepo.findById(id).get()
        assertThat(saved.id).isEqualTo(id)
        assertThat(saved.status).isEqualTo(originalStatus)
        assertThat(saved.joined).isEqualTo(originalJoined)
        assertThat(saved.daysLeftLabel).isEqualTo(originalDaysLeftLabel)
        assertThat(saved.author).isEqualTo(originalAuthor)
        assertThat(saved.authorUserId).isEqualTo(originalAuthorUserId)
        assertThat(saved.seq).isEqualTo(originalSeq)
    }

    @Test
    fun `수정 응답은 실제 소유와 참여 상태를 반환하고 authorUserId를 노출하지 않는다`() {
        val id = saveCampaign(status = "upcoming", joined = 1, authorUserId = 1)
        participantRepo.saveAndFlush(CampaignParticipant("cp-edit-owner", id, 1))

        updateCampaign(id).andExpect {
            status { isOk() }
            jsonPath("$.ownedByMe") { value(true) }
            jsonPath("$.joinedByMe") { value(true) }
            jsonPath("$.authorUserId") { doesNotExist() }
        }
    }

    // ---- ownedByMe ----

    @Test
    fun `비로그인 목록과 상세는 ownedByMe false`() {
        val id = saveCampaign(authorUserId = 1)
        mvc.get("/api/campaigns").andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$id')].ownedByMe") { value(Matchers.hasItem(false)) }
        }
        mvc.get("/api/campaigns/$id").andExpect {
            status { isOk() }
            jsonPath("$.ownedByMe") { value(false) }
        }
    }

    @Test
    fun `작성자 로그인 상세는 ownedByMe true`() {
        val id = saveCampaign(authorUserId = 1)
        mvc.get("/api/campaigns/$id") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.ownedByMe") { value(true) }
        }
    }

    @Test
    fun `다른 사용자 상세는 ownedByMe false`() {
        val id = saveCampaign(authorUserId = 1)
        mvc.get("/api/campaigns/$id") { headers { add("Authorization", "Bearer $otherToken") } }.andExpect {
            status { isOk() }
            jsonPath("$.ownedByMe") { value(false) }
        }
    }

    @Test
    fun `authorUserId가 null인 기존 캠페인은 ownedByMe false`() {
        val id = saveCampaign(authorUserId = null, authorName = "테스터")
        mvc.get("/api/campaigns/$id") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.ownedByMe") { value(false) }
        }
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
    fun `upcoming과 closed campaign 신규 참여는 400`() {
        listOf("upcoming", "closed").forEach { campaignStatus ->
            join(saveCampaign(status = campaignStatus)).andExpect { status { isBadRequest() } }
        }
    }

    @Test
    fun `정상 참여는 joined 가 1 증가`() {
        join(saveCampaign(capacity = 10, joined = 0)).andExpect {
            status { isOk() }
            jsonPath("$.joined") { value(1) }
        }
    }

    @Test
    fun `모집 시작 전과 종료 후 신규 참여는 409이고 데이터와 알림이 변하지 않는다`() {
        val ids = listOf(
            saveCampaign(authorUserId = 2, recruitStart = "2026-07-16", recruitEnd = "2026-07-31"),
            saveCampaign(authorUserId = 2, recruitStart = "2026-07-01", recruitEnd = "2026-07-14"),
        )

        ids.forEach { id ->
            join(id).andExpect { status { isConflict() } }
            assertThat(participantRepo.countByCampaignId(id)).isZero()
            assertThat(campaignRepo.findById(id).get().joined).isZero()
            assertThat(notificationRepo.findAll().none { it.href.contains(id) }).isTrue()
        }
    }

    @Test
    fun `모집 종료일 당일에는 신규 참여할 수 있다`() {
        val id = saveCampaign(recruitStart = "2026-07-01", recruitEnd = "2026-07-15")

        join(id).andExpect {
            status { isOk() }
            jsonPath("$.joined") { value(1) }
            jsonPath("$.recruitState") { value("recruiting") }
        }
    }

    @Test
    fun `비정상 legacy 모집 날짜의 신규 참여는 409다`() {
        val id = saveCampaign(recruitStart = "legacy-date", recruitEnd = "2026-07-31")

        join(id).andExpect { status { isConflict() } }
        assertThat(participantRepo.countByCampaignId(id)).isZero()
        assertThat(campaignRepo.findById(id).get().joined).isZero()
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

    @Test
    fun `기간 밖이어도 기존 참여자의 join은 멱등 200이고 알림을 만들지 않는다`() {
        val id = saveCampaign(
            joined = 1,
            authorUserId = 2,
            recruitStart = "2026-07-01",
            recruitEnd = "2026-07-14",
        )
        participantRepo.saveAndFlush(CampaignParticipant("cp-ended-idempotent", id, 1))

        join(id).andExpect {
            status { isOk() }
            jsonPath("$.joined") { value(1) }
            jsonPath("$.joinedByMe") { value(true) }
            jsonPath("$.recruitState") { value("ended") }
        }
        assertThat(participantRepo.countByCampaignId(id)).isEqualTo(1)
        assertThat(notificationRepo.findAll().none { it.href.contains(id) }).isTrue()
    }

    // ---- 참여 취소(leave) ----

    private fun leave(id: String, bearer: String? = token) =
        mvc.delete("/api/campaigns/$id/join") {
            if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
        }

    @Test
    fun `open 캠페인 참여 취소는 200이고 participant 삭제와 joined 감소`() {
        val id = saveCampaign(status = "open", joined = 1, authorUserId = 2)
        participantRepo.saveAndFlush(CampaignParticipant("cp-leave", id, 1))
        leave(id).andExpect {
            status { isOk() }
            jsonPath("$.joined") { value(0) }
            jsonPath("$.joinedByMe") { value(false) }
            jsonPath("$.ownedByMe") { value(false) }
            jsonPath("$.authorUserId") { doesNotExist() }
        }
        assertThat(participantRepo.existsByCampaignIdAndUserId(id, 1)).isFalse()
        assertThat(campaignRepo.findById(id).get().joined).isEqualTo(0)
    }

    @Test
    fun `개설자가 직접 참여한 캠페인 취소 응답은 ownedByMe true`() {
        val id = saveCampaign(status = "open", joined = 1, authorUserId = 1)
        participantRepo.saveAndFlush(CampaignParticipant("cp-leave-owner", id, 1))
        leave(id).andExpect {
            status { isOk() }
            jsonPath("$.ownedByMe") { value(true) }
            jsonPath("$.joinedByMe") { value(false) }
        }
    }

    @Test
    fun `참여하지 않은 사용자의 취소는 멱등 200이고 joined 변화 없음`() {
        val id = saveCampaign(status = "open", joined = 3)
        leave(id).andExpect {
            status { isOk() }
            jsonPath("$.joined") { value(3) }
            jsonPath("$.joinedByMe") { value(false) }
        }
        assertThat(campaignRepo.findById(id).get().joined).isEqualTo(3)
    }

    @Test
    fun `반복 취소해도 joined가 한 번만 감소한다`() {
        val id = saveCampaign(status = "open", joined = 1, authorUserId = 2)
        participantRepo.saveAndFlush(CampaignParticipant("cp-leave-rep", id, 1))
        repeat(2) { leave(id).andExpect { status { isOk() }; jsonPath("$.joined") { value(0) } } }
        assertThat(campaignRepo.findById(id).get().joined).isEqualTo(0)
    }

    @Test
    fun `participant가 없으면 closed여도 멱등 200`() {
        val id = saveCampaign(status = "closed", joined = 5)
        leave(id).andExpect {
            status { isOk() }
            jsonPath("$.joinedByMe") { value(false) }
            jsonPath("$.joined") { value(5) }
        }
    }

    @Test
    fun `participant가 있는 closed 캠페인 취소는 409이고 데이터 유지`() {
        val id = saveCampaign(status = "closed", joined = 1, authorUserId = 2)
        participantRepo.saveAndFlush(CampaignParticipant("cp-leave-closed", id, 1))
        leave(id).andExpect { status { isConflict() } }
        assertThat(participantRepo.existsByCampaignIdAndUserId(id, 1)).isTrue()
        assertThat(campaignRepo.findById(id).get().joined).isEqualTo(1)
    }

    @Test
    fun `participant가 있는 upcoming 캠페인 취소는 409이고 데이터 유지`() {
        val id = saveCampaign(status = "upcoming", joined = 1, authorUserId = 2)
        participantRepo.saveAndFlush(CampaignParticipant("cp-leave-upcoming", id, 1))
        leave(id).andExpect { status { isConflict() } }
        assertThat(participantRepo.existsByCampaignIdAndUserId(id, 1)).isTrue()
        assertThat(campaignRepo.findById(id).get().joined).isEqualTo(1)
    }

    @Test
    fun `참여 취소는 인증 없으면 401`() {
        mvc.delete("/api/campaigns/${saveCampaign(status = "open")}/join").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `없는 캠페인 취소는 404`() {
        leave("nope").andExpect { status { isNotFound() } }
    }

    @Test
    fun `다른 사용자의 participant는 삭제하지 않는다`() {
        val id = saveCampaign(status = "open", joined = 1, authorUserId = 9)
        participantRepo.saveAndFlush(CampaignParticipant("cp-leave-other", id, 2)) // 다른 유저(id=2)
        // 토큰 유저(1)는 참여한 적 없음 → 멱등 200, 데이터 변화 없음
        leave(id).andExpect { status { isOk() }; jsonPath("$.joined") { value(1) } }
        assertThat(participantRepo.existsByCampaignIdAndUserId(id, 2)).isTrue()
        assertThat(campaignRepo.findById(id).get().joined).isEqualTo(1)
    }

    @Test
    fun `joined가 0인데 participant가 있어도 취소 후 음수가 되지 않는다`() {
        val id = saveCampaign(status = "open", joined = 0, authorUserId = 2)
        participantRepo.saveAndFlush(CampaignParticipant("cp-leave-zero", id, 1))
        leave(id).andExpect { status { isOk() }; jsonPath("$.joined") { value(0) } }
        assertThat(campaignRepo.findById(id).get().joined).isEqualTo(0)
        assertThat(participantRepo.existsByCampaignIdAndUserId(id, 1)).isFalse()
    }

    @Test
    fun `취소 후 같은 open 캠페인에 다시 참여할 수 있다`() {
        val id = saveCampaign(status = "open", capacity = 10, joined = 0)
        join(id).andExpect { status { isOk() }; jsonPath("$.joined") { value(1) } }
        leave(id).andExpect { status { isOk() }; jsonPath("$.joined") { value(0) } }
        join(id).andExpect { status { isOk() }; jsonPath("$.joined") { value(1) } }
        assertThat(participantRepo.existsByCampaignIdAndUserId(id, 1)).isTrue()
    }

    @Test
    fun `정원이 찬 캠페인에서 한 명이 취소하면 다른 사용자가 참여할 수 있다`() {
        val id = saveCampaign(status = "open", capacity = 1, joined = 1)
        participantRepo.saveAndFlush(CampaignParticipant("cp-leave-full", id, 1)) // user1 이 마지막 자리
        // user2 는 정원초과로 참여 불가
        mvc.post("/api/campaigns/$id/join") { headers { add("Authorization", "Bearer $otherToken") } }
            .andExpect { status { isConflict() } }
        leave(id).andExpect { status { isOk() }; jsonPath("$.joined") { value(0) } } // user1 취소 → 자리 발생
        mvc.post("/api/campaigns/$id/join") { headers { add("Authorization", "Bearer $otherToken") } }
            .andExpect { status { isOk() }; jsonPath("$.joined") { value(1) } }
    }

    // ---- 모집 상태 변경 ----

    private fun updateStatus(id: String, target: String, bearer: String? = token) =
        mvc.put("/api/campaigns/$id/status") {
            if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"status":"$target"}"""
        }

    @Test
    fun `모집 상태 변경은 인증 없으면 401`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        updateStatus(id, "open", bearer = null).andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `개설자는 upcoming 캠페인의 모집을 시작할 수 있다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)

        updateStatus(id, "open").andExpect {
            status { isOk() }
            jsonPath("$.status") { value("open") }
            jsonPath("$.daysLeftLabel") { value("D-16") }
            jsonPath("$.recruitState") { value("recruiting") }
            jsonPath("$.recruitable") { value(true) }
            jsonPath("$.ownedByMe") { value(true) }
            jsonPath("$.joinedByMe") { value(false) }
        }

        val saved = campaignRepo.findById(id).get()
        assertThat(saved.status).isEqualTo("open")
        assertThat(saved.daysLeftLabel).isEqualTo("모집중")
    }

    @Test
    fun `다른 사용자는 모집 상태를 변경할 수 없다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)

        updateStatus(id, "open", bearer = otherToken).andExpect { status { isForbidden() } }

        assertThat(campaignRepo.findById(id).get().status).isEqualTo("upcoming")
    }

    @Test
    fun `authorUserId가 null인 캠페인 상태 변경은 403`() {
        val id = saveCampaign(status = "upcoming", authorUserId = null)
        updateStatus(id, "open").andExpect { status { isForbidden() } }
    }

    @Test
    fun `없는 캠페인 상태 변경은 404`() {
        updateStatus("nope", "open").andExpect { status { isNotFound() } }
    }

    @Test
    fun `open 캠페인은 closed로 마감할 수 있다`() {
        val id = saveCampaign(status = "open", authorUserId = 1)

        updateStatus(id, "closed").andExpect {
            status { isOk() }
            jsonPath("$.status") { value("closed") }
            jsonPath("$.daysLeftLabel") { value("모집완료") }
            jsonPath("$.recruitState") { value("closed") }
            jsonPath("$.recruitable") { value(false) }
        }

        val saved = campaignRepo.findById(id).get()
        assertThat(saved.status).isEqualTo("closed")
        assertThat(saved.daysLeftLabel).isEqualTo("모집완료")
    }

    @Test
    fun `open에서 open 요청은 멱등 200이고 변경하지 않는다`() {
        val id = saveCampaign(status = "open", authorUserId = 1)
        updateStatus(id, "open").andExpect {
            status { isOk() }
            jsonPath("$.status") { value("open") }
            jsonPath("$.daysLeftLabel") { value("D-16") }
        }
    }

    @Test
    fun `closed에서 closed 요청은 멱등 200이고 변경하지 않는다`() {
        val id = saveCampaign(status = "closed", authorUserId = 1)
        updateStatus(id, "closed").andExpect {
            status { isOk() }
            jsonPath("$.status") { value("closed") }
            jsonPath("$.daysLeftLabel") { value("모집완료") }
        }
    }

    @Test
    fun `closed 캠페인은 다시 open으로 변경할 수 없고 기존 상태를 유지한다`() {
        val id = saveCampaign(status = "closed", authorUserId = 1)
        updateStatus(id, "open").andExpect { status { isConflict() } }
        assertThat(campaignRepo.findById(id).orElseThrow().status).isEqualTo("closed")
    }

    @Test
    fun `upcoming 캠페인은 바로 closed로 변경할 수 없고 기존 상태를 유지한다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        updateStatus(id, "closed").andExpect { status { isConflict() } }
        assertThat(campaignRepo.findById(id).orElseThrow().status).isEqualTo("upcoming")
    }

    @Test
    fun `open과 closed 이외의 target status는 400`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        listOf("upcoming", "paused").forEach { target ->
            updateStatus(id, target).andExpect { status { isBadRequest() } }
        }
    }

    @Test
    fun `상태 변경 응답은 실제 참여 상태를 반영한다`() {
        val id = saveCampaign(status = "upcoming", joined = 1, authorUserId = 1)
        participantRepo.saveAndFlush(CampaignParticipant("cp-status-owner", id, 1))

        updateStatus(id, "open").andExpect {
            status { isOk() }
            jsonPath("$.ownedByMe") { value(true) }
            jsonPath("$.joinedByMe") { value(true) }
        }
    }

    @Test
    fun `모집 마감 후에는 참여할 수 없다`() {
        val id = saveCampaign(status = "open", authorUserId = 1)
        updateStatus(id, "closed").andExpect { status { isOk() } }
        join(id).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `모집 시작 후에는 참여할 수 있다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        updateStatus(id, "open").andExpect { status { isOk() } }
        join(id).andExpect {
            status { isOk() }
            jsonPath("$.joined") { value(1) }
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
    fun `join 응답은 실제 캠페인 소유 여부를 반영한다`() {
        val ownedId = saveCampaign(authorUserId = 1)
        val otherId = saveCampaign(authorUserId = 2)

        join(ownedId).andExpect {
            status { isOk() }
            jsonPath("$.ownedByMe") { value(true) }
        }
        join(otherId).andExpect {
            status { isOk() }
            jsonPath("$.ownedByMe") { value(false) }
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
    fun `joined 목록은 실제 캠페인 소유 여부를 반영한다`() {
        val ownedId = saveCampaign(authorUserId = 1)
        val otherId = saveCampaign(authorUserId = 2)
        participantRepo.saveAndFlush(CampaignParticipant("cp-owned-list", ownedId, 1))
        participantRepo.saveAndFlush(CampaignParticipant("cp-other-list", otherId, 1))

        mvc.get("/api/campaigns/joined") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$ownedId')].ownedByMe") { value(Matchers.hasItem(true)) }
            jsonPath("$[?(@.id == '$otherId')].ownedByMe") { value(Matchers.hasItem(false)) }
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

    // ---- 개설 캠페인 목록(mine) ----

    @Test
    fun `비로그인 GET mine은 401`() {
        mvc.get("/api/campaigns/mine").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `개설한 캠페인이 없으면 빈 배열`() {
        mvc.get("/api/campaigns/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(0) }
        }
    }

    @Test
    fun `현재 사용자가 개설한 캠페인만 반환한다`() {
        val mine = saveCampaign(authorUserId = 1)
        saveCampaign(authorUserId = 2)
        saveCampaign(authorUserId = null)

        mvc.get("/api/campaigns/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(1) }
            jsonPath("$[0].id") { value(mine) }
        }
    }

    @Test
    fun `다른 사용자가 개설한 캠페인은 mine에서 제외한다`() {
        saveCampaign(authorUserId = 2)

        mvc.get("/api/campaigns/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(0) }
        }
    }

    @Test
    fun `authorUserId가 null인 캠페인은 mine에서 제외한다`() {
        saveCampaign(authorUserId = null, authorName = "테스터")

        mvc.get("/api/campaigns/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(0) }
        }
    }

    @Test
    fun `mine 캠페인은 seq DESC로 정렬한다`() {
        val oldest = saveCampaign(seq = 100, authorUserId = 1)
        val newest = saveCampaign(seq = 300, authorUserId = 1)
        val middle = saveCampaign(seq = 200, authorUserId = 1)

        mvc.get("/api/campaigns/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[0].id") { value(newest) }
            jsonPath("$[1].id") { value(middle) }
            jsonPath("$[2].id") { value(oldest) }
        }
    }

    @Test
    fun `mine 응답은 ownedByMe true`() {
        saveCampaign(authorUserId = 1)
        saveCampaign(authorUserId = 1)

        mvc.get("/api/campaigns/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[*].ownedByMe") { value(Matchers.everyItem(Matchers.equalTo(true))) }
        }
    }

    @Test
    fun `mine 응답은 실제 참여 여부를 반영한다`() {
        val joinedId = saveCampaign(authorUserId = 1)
        val notJoinedId = saveCampaign(authorUserId = 1)
        participantRepo.saveAndFlush(CampaignParticipant("cp-mine-joined", joinedId, 1))

        mvc.get("/api/campaigns/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$joinedId')].joinedByMe") { value(Matchers.hasItem(true)) }
            jsonPath("$[?(@.id == '$notJoinedId')].joinedByMe") { value(Matchers.hasItem(false)) }
        }
    }

    // ---- 삭제(DELETE) ----

    private fun deleteCampaign(id: String, bearer: String? = token) =
        mvc.delete("/api/campaigns/$id") {
            if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
        }

    private fun savePostLinkedTo(campaignId: String, authorUserId: Long = 1): String {
        val id = "p-${UUID.randomUUID()}"
        postRepo.saveAndFlush(
            Post(
                id, Author("작성자", false), "방금", "연결 본문",
                emptyList(), emptyList(), 0, 0, campaignId, System.nanoTime(), authorUserId,
            ),
        )
        return id
    }

    @Test
    fun `개설자는 upcoming 캠페인을 삭제하면 204이고 row가 사라진다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        deleteCampaign(id).andExpect { status { isNoContent() } }
        assertThat(campaignRepo.existsById(id)).isFalse()
    }

    @Test
    fun `삭제한 캠페인은 mine 목록에서 제외된다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        deleteCampaign(id).andExpect { status { isNoContent() } }
        mvc.get("/api/campaigns/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$id')]") { value(Matchers.empty<Any>()) }
        }
    }

    @Test
    fun `삭제 성공 후 재삭제는 404`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        deleteCampaign(id).andExpect { status { isNoContent() } }
        deleteCampaign(id).andExpect { status { isNotFound() } }
    }

    @Test
    fun `비로그인 삭제는 401`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        deleteCampaign(id, bearer = null).andExpect { status { isUnauthorized() } }
        assertThat(campaignRepo.existsById(id)).isTrue()
    }

    @Test
    fun `다른 사용자 삭제는 403이고 캠페인은 유지된다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        deleteCampaign(id, bearer = otherToken).andExpect { status { isForbidden() } }
        assertThat(campaignRepo.existsById(id)).isTrue()
    }

    @Test
    fun `authorUserId가 null인 캠페인 삭제는 403`() {
        val id = saveCampaign(status = "upcoming", authorUserId = null)
        deleteCampaign(id).andExpect { status { isForbidden() } }
        assertThat(campaignRepo.existsById(id)).isTrue()
    }

    @Test
    fun `없는 캠페인 삭제는 404`() {
        deleteCampaign("nope").andExpect { status { isNotFound() } }
    }

    @Test
    fun `open 캠페인 삭제는 409이고 DB에 유지된다`() {
        val id = saveCampaign(status = "open", authorUserId = 1)
        deleteCampaign(id).andExpect { status { isConflict() } }
        assertThat(campaignRepo.existsById(id)).isTrue()
    }

    @Test
    fun `closed 캠페인 삭제는 409이고 DB에 유지된다`() {
        val id = saveCampaign(status = "closed", authorUserId = 1)
        deleteCampaign(id).andExpect { status { isConflict() } }
        assertThat(campaignRepo.existsById(id)).isTrue()
    }

    @Test
    fun `joined가 1 이상이면 409`() {
        val id = saveCampaign(status = "upcoming", joined = 1, authorUserId = 1)
        deleteCampaign(id).andExpect { status { isConflict() } }
        assertThat(campaignRepo.existsById(id)).isTrue()
    }

    @Test
    fun `participant row가 있으면 joined가 0이어도 409이고 데이터가 유지된다`() {
        val id = saveCampaign(status = "upcoming", joined = 0, authorUserId = 1)
        participantRepo.saveAndFlush(CampaignParticipant("cp-del-guard", id, 999))
        deleteCampaign(id).andExpect { status { isConflict() } }
        assertThat(campaignRepo.existsById(id)).isTrue()
        assertThat(participantRepo.countByCampaignId(id)).isEqualTo(1)
    }

    @Test
    fun `연결 게시글이 있으면 409이고 게시글과 캠페인이 유지된다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        val postId = savePostLinkedTo(id)
        deleteCampaign(id).andExpect { status { isConflict() } }
        assertThat(campaignRepo.existsById(id)).isTrue()
        assertThat(postRepo.existsById(postId)).isTrue()
    }

    @Test
    fun `다른 캠페인의 게시글은 삭제를 막지 않는다`() {
        val target = saveCampaign(status = "upcoming", authorUserId = 1)
        val other = saveCampaign(status = "upcoming", authorUserId = 1)
        savePostLinkedTo(other) // 다른 캠페인에만 연결된 게시글
        deleteCampaign(target).andExpect { status { isNoContent() } }
        assertThat(campaignRepo.existsById(target)).isFalse()
    }

    // ---- 북마크 ----

    @Test
    fun `북마크 추가와 삭제는 인증 없으면 401`() {
        val id = saveCampaign()
        mvc.post("/api/campaigns/$id/bookmark").andExpect { status { isUnauthorized() } }
        mvc.delete("/api/campaigns/$id/bookmark").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `없는 campaign 북마크 추가와 삭제는 404`() {
        mvc.post("/api/campaigns/nope/bookmark") { headers { add("Authorization", "Bearer $token") } }
            .andExpect { status { isNotFound() } }
        mvc.delete("/api/campaigns/nope/bookmark") { headers { add("Authorization", "Bearer $token") } }
            .andExpect { status { isNotFound() } }
    }

    @Test
    fun `북마크 POST 응답은 bookmarkedByMe true`() {
        val id = saveCampaign()
        mvc.post("/api/campaigns/$id/bookmark") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$.bookmarkedByMe") { value(true) }
            }
    }

    @Test
    fun `같은 북마크 POST를 반복해도 row는 하나이고 모두 200`() {
        val id = saveCampaign()
        repeat(2) {
            mvc.post("/api/campaigns/$id/bookmark") { headers { add("Authorization", "Bearer $token") } }
                .andExpect { status { isOk() } }
        }
        assertThat(bookmarkRepo.countByCampaignId(id)).isEqualTo(1)
    }

    @Test
    fun `북마크 DELETE 응답은 bookmarkedByMe false`() {
        val id = saveCampaign()
        bookmarkRepo.saveAndFlush(CampaignBookmark("cbk-delete", id, 1))
        mvc.delete("/api/campaigns/$id/bookmark") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$.bookmarkedByMe") { value(false) }
            }
        assertThat(bookmarkRepo.countByCampaignId(id)).isZero()
    }

    @Test
    fun `북마크하지 않은 DELETE도 idempotent 200`() {
        val id = saveCampaign()
        mvc.delete("/api/campaigns/$id/bookmark") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$.bookmarkedByMe") { value(false) }
            }
    }

    @Test
    fun `비로그인 GET은 bookmarkedByMe false`() {
        val id = saveCampaign()
        mvc.get("/api/campaigns/$id").andExpect {
            status { isOk() }
            jsonPath("$.bookmarkedByMe") { value(false) }
        }
        mvc.get("/api/campaigns").andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$id')].bookmarkedByMe") { value(Matchers.hasItem(false)) }
        }
    }

    @Test
    fun `로그인 사용자가 북마크한 단건과 목록은 bookmarkedByMe true`() {
        val id = saveCampaign()
        bookmarkRepo.saveAndFlush(CampaignBookmark("cbk-get", id, 1))
        mvc.get("/api/campaigns/$id") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.bookmarkedByMe") { value(true) }
        }
        mvc.get("/api/campaigns") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$id')].bookmarkedByMe") { value(Matchers.hasItem(true)) }
        }
    }

    @Test
    fun `비로그인 북마크 목록 요청은 401`() {
        mvc.get("/api/campaigns/bookmarks").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `북마크가 없으면 빈 배열`() {
        mvc.get("/api/campaigns/bookmarks") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(0) }
        }
    }

    @Test
    fun `현재 사용자가 북마크한 캠페인만 반환한다`() {
        val bookmarkedId = saveCampaign()
        saveCampaign()
        bookmarkRepo.saveAndFlush(CampaignBookmark("cbk-list-mine", bookmarkedId, 1))

        mvc.get("/api/campaigns/bookmarks") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(1) }
            jsonPath("$[0].id") { value(bookmarkedId) }
        }
    }

    @Test
    fun `다른 사용자의 북마크는 반환하지 않는다`() {
        val otherUserCampaignId = saveCampaign()
        bookmarkRepo.saveAndFlush(CampaignBookmark("cbk-list-other", otherUserCampaignId, 2))

        mvc.get("/api/campaigns/bookmarks") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(0) }
        }
    }

    @Test
    fun `북마크 목록의 bookmarkedByMe는 모두 true`() {
        val firstId = saveCampaign()
        val secondId = saveCampaign()
        bookmarkRepo.saveAllAndFlush(
            listOf(
                CampaignBookmark("cbk-all-true-1", firstId, 1),
                CampaignBookmark("cbk-all-true-2", secondId, 1),
            ),
        )

        mvc.get("/api/campaigns/bookmarks") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[*].bookmarkedByMe") { value(Matchers.everyItem(Matchers.equalTo(true))) }
        }
    }

    @Test
    fun `삭제하면 북마크 row도 함께 삭제된다`() {
        val id = saveCampaign(status = "upcoming", authorUserId = 1)
        bookmarkRepo.saveAndFlush(CampaignBookmark("cbk-del", id, 2))
        deleteCampaign(id).andExpect { status { isNoContent() } }
        assertThat(bookmarkRepo.countByCampaignId(id)).isEqualTo(0)
    }
}

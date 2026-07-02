package com.dasida.api.campaign

import com.dasida.api.auth.User
import com.dasida.api.post.Author
import com.dasida.api.security.JwtService
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CampaignMyPagePaginationTest(
    @Autowired val mvc: MockMvc,
    @Autowired val jwt: JwtService,
    @Autowired val campaignRepo: CampaignRepository,
    @Autowired val participantRepo: CampaignParticipantRepository,
) {
    private val me = 1L
    private val token = jwt.issue(User(id = me, email = "me@t.com", passwordHash = "x", name = "나", verified = false))

    private fun saveCampaign(seq: Long, authorUserId: Long? = me): String {
        val id = "cpg-${UUID.randomUUID()}"
        campaignRepo.saveAndFlush(
            Campaign(
                id, "open", "캠페인", "요약", "https://x/y.png",
                "2026-07-01", "2026-07-31", "2026-08-05", "2026-08-30",
                10, 0, "라벨", Author("개설자", false),
                CampaignBody("소개", emptyList(), emptyList()),
                seq = seq, authorUserId = authorUserId,
            ),
        )
        return id
    }

    private fun addParticipant(campaignId: String, userId: Long = me): String {
        val id = "cp-${UUID.randomUUID()}"
        participantRepo.saveAndFlush(CampaignParticipant(id, campaignId, userId))
        return id
    }

    // ---- 인증 ----

    @Test
    fun `비로그인은 401`() {
        mvc.get("/api/campaigns/joined/page").andExpect { status { isUnauthorized() } }
        mvc.get("/api/campaigns/mine/page").andExpect { status { isUnauthorized() } }
    }

    // ---- page/size ----

    @Test
    fun `page와 size를 검증한다`() {
        for (path in listOf("/api/campaigns/joined/page", "/api/campaigns/mine/page")) {
            mvc.get(path) { headers { add("Authorization", "Bearer $token") }; param("page", "-1") }
                .andExpect { status { isBadRequest() } }
            mvc.get(path) { headers { add("Authorization", "Bearer $token") }; param("size", "0") }
                .andExpect { status { isBadRequest() } }
            mvc.get(path) { headers { add("Authorization", "Bearer $token") }; param("size", "51") }
                .andExpect { status { isBadRequest() } }
            mvc.get(path) { headers { add("Authorization", "Bearer $token") } }
                .andExpect { status { isOk() }; jsonPath("$.size") { value(9) } } // 기본 size
        }
    }

    // ---- 참여 캠페인 ----

    @Test
    fun `내 참여 캠페인만 반환하고 joinedByMe true와 ownedByMe가 정확하다`() {
        val mineOwned = saveCampaign(seq = 1, authorUserId = me) // 내가 개설하고 참여까지
        val otherOwned = saveCampaign(seq = 2, authorUserId = 2L) // 남이 개설, 내가 참여
        val notJoined = saveCampaign(seq = 3, authorUserId = 2L) // 참여 안 함
        addParticipant(mineOwned)
        addParticipant(otherOwned)
        addParticipant(notJoined, userId = 2L) // 다른 사용자 참여

        mvc.get("/api/campaigns/joined/page") {
            headers { add("Authorization", "Bearer $token") }
            param("size", "9")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(2) }
            jsonPath("$.content[*].joinedByMe") { value(Matchers.everyItem(Matchers.equalTo(true))) }
            jsonPath("$.content[?(@.id == '$mineOwned')].ownedByMe") { value(Matchers.hasItem(true)) }
            jsonPath("$.content[?(@.id == '$otherOwned')].ownedByMe") { value(Matchers.hasItem(false)) }
        }
    }

    @Test
    fun `참여 취소 후 결과에서 제외된다`() {
        val id = saveCampaign(seq = 1, authorUserId = 2L)
        val pid = addParticipant(id)
        participantRepo.deleteById(pid)

        mvc.get("/api/campaigns/joined/page") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$.totalElements") { value(0) }
                jsonPath("$.content.length()") { value(0) }
            }
    }

    @Test
    fun `기존 joined 배열 응답은 유지된다`() {
        val id = saveCampaign(seq = 1, authorUserId = 2L)
        addParticipant(id)
        mvc.get("/api/campaigns/joined") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$") { isArray() }
                jsonPath("$.length()") { value(1) }
            }
    }

    // ---- 개설 캠페인 ----

    @Test
    fun `내 개설 캠페인만 최신순으로 반환하고 상태가 정확하다`() {
        val older = saveCampaign(seq = 1, authorUserId = me)
        val newer = saveCampaign(seq = 2, authorUserId = me)
        saveCampaign(seq = 3, authorUserId = 2L) // 남의 캠페인
        saveCampaign(seq = 4, authorUserId = null) // 레거시(authorUserId null)
        addParticipant(newer) // 내가 내 캠페인에 참여

        mvc.get("/api/campaigns/mine/page") {
            headers { add("Authorization", "Bearer $token") }
            param("size", "9")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(2) } // 남/레거시 미포함
            jsonPath("$.content[*].id") { value(Matchers.contains(newer, older)) } // 최신순
            jsonPath("$.content[*].ownedByMe") { value(Matchers.everyItem(Matchers.equalTo(true))) }
            jsonPath("$.content[?(@.id == '$newer')].joinedByMe") { value(Matchers.hasItem(true)) }
            jsonPath("$.content[?(@.id == '$older')].joinedByMe") { value(Matchers.hasItem(false)) }
        }
    }

    @Test
    fun `개설 캠페인 page 분할`() {
        repeat(3) { saveCampaign(seq = it.toLong(), authorUserId = me) }
        mvc.get("/api/campaigns/mine/page") {
            headers { add("Authorization", "Bearer $token") }
            param("page", "1"); param("size", "2")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(1) }
            jsonPath("$.page") { value(1) }
            jsonPath("$.totalElements") { value(3) }
            jsonPath("$.totalPages") { value(2) }
        }
    }

    @Test
    fun `기존 mine 배열 응답은 유지된다`() {
        saveCampaign(seq = 1, authorUserId = me)
        mvc.get("/api/campaigns/mine") { headers { add("Authorization", "Bearer $token") } }
            .andExpect {
                status { isOk() }
                jsonPath("$") { isArray() }
                jsonPath("$.length()") { value(1) }
            }
    }
}

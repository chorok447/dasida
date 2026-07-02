package com.dasida.api.campaign

import com.dasida.api.auth.User
import com.dasida.api.post.Author
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Import(FixedClockTestConfiguration::class)
class CampaignSearchControllerTest(
    @Autowired private val mvc: MockMvc,
    @Autowired private val jwt: JwtService,
    @Autowired private val campaignRepo: CampaignRepository,
    @Autowired private val participantRepo: CampaignParticipantRepository,
) {
    private val token = jwt.issue(
        User(id = 1, email = "search@test.com", passwordHash = "x", name = "검색 사용자", verified = true),
    )

    private fun marker(prefix: String = "search"): String =
        "$prefix-${UUID.randomUUID().toString().replace("-", "")}"

    private fun saveCampaign(
        id: String = "search-${UUID.randomUUID()}",
        status: String = "open",
        title: String = "검색 캠페인",
        summary: String = "검색 요약",
        capacity: Int = 10,
        joined: Int = 0,
        seq: Long = System.nanoTime(),
        authorUserId: Long? = null,
        recruitStart: String = "2026-07-01",
        recruitEnd: String = "2026-07-31",
        runStart: String = "2026-08-01",
    ): String {
        campaignRepo.saveAndFlush(
            Campaign(
                id = id,
                status = status,
                title = title,
                summary = summary,
                thumb = "https://example.com/campaign.png",
                recruitStart = recruitStart,
                recruitEnd = recruitEnd,
                runStart = runStart,
                runEnd = "2026-08-31",
                capacity = capacity,
                joined = joined,
                daysLeftLabel = "검색 테스트",
                author = Author("개설자", false),
                body = CampaignBody("소개", emptyList(), emptyList()),
                seq = seq,
                authorUserId = authorUserId,
            ),
        )
        return id
    }

    @Test
    fun `기본 검색은 latest page 0 size 9를 사용한다`() {
        val newest = saveCampaign(seq = Long.MAX_VALUE)
        val next = saveCampaign(seq = Long.MAX_VALUE - 1)

        mvc.get("/api/campaigns/search").andExpect {
            status { isOk() }
            jsonPath("$.page") { value(0) }
            jsonPath("$.size") { value(9) }
            jsonPath("$.content.length()") { value(9) }
            jsonPath("$.content[0].id") { value(newest) }
            jsonPath("$.content[1].id") { value(next) }
        }
    }

    @Test
    fun `제목과 요약을 대소문자 무시 부분 검색한다`() {
        val titleKeyword = marker("TitleCase")
        val summaryKeyword = marker("SummaryCase")
        val titleId = saveCampaign(title = "앞 ${titleKeyword.uppercase()} 뒤")
        val summaryId = saveCampaign(summary = "앞 ${summaryKeyword.uppercase()} 뒤")

        mvc.get("/api/campaigns/search") { param("q", titleKeyword.lowercase()) }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].id") { value(titleId) }
        }
        mvc.get("/api/campaigns/search") { param("q", summaryKeyword.lowercase()) }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].id") { value(summaryId) }
        }
    }

    @Test
    fun `한글 검색어를 제목과 요약에서 찾는다`() {
        val keyword = "한글검색${UUID.randomUUID().toString().take(8)}"
        val id = saveCampaign(summary = "업사이클링 $keyword 캠페인")

        mvc.get("/api/campaigns/search") { param("q", keyword) }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].id") { value(id) }
        }
    }

    @Test
    fun `검색어는 trim하고 빈 문자열은 조건에서 제외한다`() {
        val keyword = marker("trim")
        val matched = saveCampaign(title = "제목 $keyword")
        val newest = saveCampaign(seq = Long.MAX_VALUE)

        mvc.get("/api/campaigns/search") { param("q", "  $keyword  ") }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].id") { value(matched) }
        }
        mvc.get("/api/campaigns/search") {
            param("q", "   ")
            param("size", "1")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].id") { value(newest) }
        }
    }

    @Test
    fun `100자를 초과한 검색어는 400`() {
        mvc.get("/api/campaigns/search") { param("q", "가".repeat(101)) }
            .andExpect { status { isBadRequest() } }
    }

    @Test
    fun `status별로 필터하고 잘못된 status는 400`() {
        val keyword = marker("status")
        val open = saveCampaign(status = "open", summary = keyword)
        val upcoming = saveCampaign(status = "upcoming", summary = keyword)
        val closed = saveCampaign(status = "closed", summary = keyword)

        listOf("open" to open, "upcoming" to upcoming, "closed" to closed).forEach { (status, id) ->
            mvc.get("/api/campaigns/search") {
                param("q", keyword)
                param("status", status)
            }.andExpect {
                status { isOk() }
                jsonPath("$.totalElements") { value(1) }
                jsonPath("$.content[0].id") { value(id) }
            }
        }
        mvc.get("/api/campaigns/search") { param("status", "draft") }
            .andExpect { status { isBadRequest() } }
    }

    @Test
    fun `recruitState는 현재 날짜와 운영 상태로 파생해 필터한다`() {
        val keyword = marker("recruit-state")
        val upcoming = saveCampaign(status = "upcoming", summary = keyword, seq = 600)
        val openBefore = saveCampaign(
            status = "open",
            summary = keyword,
            recruitStart = "2026-07-16",
            recruitEnd = "2026-07-31",
            seq = 500,
        )
        val recruiting = saveCampaign(
            status = "open",
            summary = keyword,
            recruitStart = "2026-07-15",
            recruitEnd = "2026-07-15",
            seq = 400,
        )
        val ended = saveCampaign(
            status = "open",
            summary = keyword,
            recruitStart = "2026-07-01",
            recruitEnd = "2026-07-14",
            seq = 300,
        )
        val closed = saveCampaign(status = "closed", summary = keyword, seq = 200)

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("recruitState", "before_recruit")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(2) }
            jsonPath("$.content[*].id") { value(Matchers.contains(upcoming, openBefore)) }
            jsonPath("$.content[*].recruitState") {
                value(Matchers.everyItem(Matchers.`is`("before_recruit")))
            }
        }
        listOf(
            "recruiting" to recruiting,
            "ended" to ended,
            "closed" to closed,
        ).forEach { (state, id) ->
            mvc.get("/api/campaigns/search") {
                param("q", keyword)
                param("recruitState", state)
            }.andExpect {
                status { isOk() }
                jsonPath("$.totalElements") { value(1) }
                jsonPath("$.content[0].id") { value(id) }
                jsonPath("$.content[0].recruitState") { value(state) }
            }
        }
        mvc.get("/api/campaigns/search") { param("q", keyword) }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(5) }
        }
    }

    @Test
    fun `recruitState는 정확한 lowercase 값만 허용한다`() {
        listOf("RECRUITING", "before-recruit", "unknown").forEach { recruitState ->
            mvc.get("/api/campaigns/search") { param("recruitState", recruitState) }
                .andExpect { status { isBadRequest() } }
        }
    }

    @Test
    fun `status와 검색어와 recruitState는 교집합으로 적용한다`() {
        val keyword = marker("recruit-intersection")
        val recruiting = saveCampaign(
            status = "open",
            title = "$keyword 모집 중",
            recruitStart = "2026-07-01",
            recruitEnd = "2026-07-31",
        )
        saveCampaign(
            status = "open",
            title = "$keyword 모집 종료",
            recruitStart = "2026-07-01",
            recruitEnd = "2026-07-14",
        )
        saveCampaign(status = "closed", title = "$keyword 마감")

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("status", "open")
            param("recruitState", "recruiting")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].id") { value(recruiting) }
            jsonPath("$.content[0].recruitState") { value("recruiting") }
            jsonPath("$.content[0].recruitable") { value(true) }
        }
        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("status", "closed")
            param("recruitState", "recruiting")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(0) }
            jsonPath("$.content.length()") { value(0) }
        }
    }

    @Test
    fun `availableOnly는 모집 기간 중이고 정원이 남은 open 캠페인만 반환한다`() {
        val keyword = marker("available")
        val available = saveCampaign(status = "open", capacity = 3, joined = 2, summary = keyword)
        saveCampaign(status = "open", capacity = 3, joined = 3, summary = keyword)
        saveCampaign(status = "upcoming", capacity = 3, joined = 0, summary = keyword)
        saveCampaign(status = "closed", capacity = 3, joined = 1, summary = keyword)
        saveCampaign(
            status = "open",
            capacity = 3,
            joined = 0,
            summary = keyword,
            recruitStart = "2026-07-16",
        )
        saveCampaign(
            status = "open",
            capacity = 3,
            joined = 0,
            summary = keyword,
            recruitEnd = "2026-07-14",
        )

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("availableOnly", "true")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].id") { value(available) }
        }
        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("status", "closed")
            param("availableOnly", "true")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(0) }
            jsonPath("$.content.length()") { value(0) }
        }
        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("recruitState", "recruiting")
            param("availableOnly", "true")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].id") { value(available) }
        }
        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("recruitState", "before_recruit")
            param("availableOnly", "true")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(0) }
        }
    }

    @Test
    fun `날짜 검색 파라미터는 canonical ISO만 허용하고 빈 값은 생략한다`() {
        val keyword = marker("date-params")
        val id = saveCampaign(
            summary = keyword,
            recruitEnd = "2026-07-20",
            runStart = "2026-08-10",
        )

        mapOf(
            "recruitEndFrom" to " 2026-07-20 ",
            "recruitEndTo" to "2026-07-20",
            "runStartFrom" to "2026-08-10",
            "runStartTo" to "2026-08-10",
        ).forEach { (name, value) ->
            mvc.get("/api/campaigns/search") {
                param("q", keyword)
                param(name, value)
            }.andExpect {
                status { isOk() }
                jsonPath("$.totalElements") { value(1) }
                jsonPath("$.content[0].id") { value(id) }
            }
        }

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("recruitEndFrom", "")
            param("recruitEndTo", "   ")
            param("runStartFrom", "")
            param("runStartTo", "   ")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
        }

        mapOf(
            "recruitEndFrom" to "2026.07.20",
            "recruitEndTo" to "2026/07/20",
            "runStartFrom" to "2026-02-30",
            "runStartTo" to "not-a-date",
        ).forEach { (name, value) ->
            mvc.get("/api/campaigns/search") { param(name, value) }
                .andExpect { status { isBadRequest() } }
        }
    }

    @Test
    fun `날짜 검색 범위의 시작일이 종료일보다 늦으면 400`() {
        mvc.get("/api/campaigns/search") {
            param("recruitEndFrom", "2026-07-31")
            param("recruitEndTo", "2026-07-01")
        }.andExpect { status { isBadRequest() } }

        mvc.get("/api/campaigns/search") {
            param("runStartFrom", "2026-08-31")
            param("runStartTo", "2026-08-01")
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `모집 종료일 범위는 경계를 포함한다`() {
        val keyword = marker("recruit-end-range")
        val early = saveCampaign(summary = keyword, recruitEnd = "2026-07-10", seq = 300)
        val boundary = saveCampaign(summary = keyword, recruitEnd = "2026-07-20", seq = 200)
        val late = saveCampaign(summary = keyword, recruitEnd = "2026-07-30", seq = 100)

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("recruitEndFrom", "2026-07-20")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[*].id") { value(Matchers.contains(boundary, late)) }
        }
        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("recruitEndTo", "2026-07-20")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[*].id") { value(Matchers.contains(early, boundary)) }
        }
        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("recruitEndFrom", "2026-07-20")
            param("recruitEndTo", "2026-07-20")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].id") { value(boundary) }
        }
    }

    @Test
    fun `진행 시작일 범위는 경계를 포함한다`() {
        val keyword = marker("run-start-range")
        val early = saveCampaign(summary = keyword, runStart = "2026-08-01", seq = 300)
        val boundary = saveCampaign(summary = keyword, runStart = "2026-08-10", seq = 200)
        val late = saveCampaign(summary = keyword, runStart = "2026-08-20", seq = 100)

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("runStartFrom", "2026-08-10")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[*].id") { value(Matchers.contains(boundary, late)) }
        }
        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("runStartTo", "2026-08-10")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[*].id") { value(Matchers.contains(early, boundary)) }
        }
        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("runStartFrom", "2026-08-10")
            param("runStartTo", "2026-08-10")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].id") { value(boundary) }
        }
    }

    @Test
    fun `날짜 범위는 기존 검색 조건과 정렬 및 pagination에 교집합으로 적용한다`() {
        val keyword = marker("date-intersection")
        val early = saveCampaign(
            status = "open",
            summary = keyword,
            capacity = 3,
            joined = 1,
            recruitStart = "2026-07-01",
            recruitEnd = "2026-07-20",
            runStart = "2026-08-10",
        )
        val late = saveCampaign(
            status = "open",
            summary = keyword,
            capacity = 3,
            joined = 2,
            recruitStart = "2026-07-01",
            recruitEnd = "2026-07-25",
            runStart = "2026-08-15",
        )
        saveCampaign(
            status = "open",
            summary = keyword,
            capacity = 3,
            joined = 3,
            recruitEnd = "2026-07-22",
            runStart = "2026-08-12",
        )
        saveCampaign(status = "closed", summary = keyword, recruitEnd = "2026-07-21", runStart = "2026-08-11")

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("status", "open")
            param("recruitState", "recruiting")
            param("availableOnly", "true")
            param("recruitEndFrom", "2026-07-20")
            param("recruitEndTo", "2026-07-25")
            param("runStartFrom", "2026-08-10")
            param("runStartTo", "2026-08-15")
            param("sort", "deadline")
            param("size", "1")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].id") { value(early) }
            jsonPath("$.totalElements") { value(2) }
            jsonPath("$.totalPages") { value(2) }
        }
        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("status", "open")
            param("recruitState", "recruiting")
            param("availableOnly", "true")
            param("recruitEndFrom", "2026-07-20")
            param("recruitEndTo", "2026-07-25")
            param("runStartFrom", "2026-08-10")
            param("runStartTo", "2026-08-15")
            param("sort", "deadline")
            param("page", "1")
            param("size", "1")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].id") { value(late) }
        }
    }

    @Test
    fun `비정상 legacy 날짜가 남아 있어도 날짜 검색은 500이 아니다`() {
        val keyword = marker("date-legacy")
        saveCampaign(summary = keyword, recruitEnd = "legacy-date", runStart = "legacy-date")

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("recruitEndFrom", "2026-01-01")
            param("runStartTo", "2026-12-31")
        }.andExpect { status { isOk() } }
    }

    @Test
    fun `latest와 popular 정렬은 명시적 tie breaker를 사용한다`() {
        val keyword = marker("sort")
        val latest = saveCampaign(id = "sort-z-${UUID.randomUUID()}", summary = keyword, joined = 1, seq = 300)
        val popular = saveCampaign(id = "sort-y-${UUID.randomUUID()}", summary = keyword, joined = 9, seq = 100)
        val tieA = saveCampaign(id = "sort-a-${UUID.randomUUID()}", summary = keyword, joined = 5, seq = 200)
        val tieB = saveCampaign(id = "sort-b-${UUID.randomUUID()}", summary = keyword, joined = 5, seq = 200)

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("sort", "latest")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[*].id") { value(Matchers.contains(latest, tieA, tieB, popular)) }
        }
        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("sort", "popular")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[*].id") { value(Matchers.contains(popular, tieA, tieB, latest)) }
        }
    }

    @Test
    fun `deadline은 모집중을 우선하고 종료일과 tie breaker 순으로 정렬한다`() {
        val keyword = marker("deadline-order")
        val prefix = "deadline-${UUID.randomUUID()}"
        val openEarly = saveCampaign(
            id = "$prefix-open-early",
            status = "open",
            summary = keyword,
            recruitEnd = "2026-07-01",
            seq = 100,
        )
        val openTieA = saveCampaign(
            id = "$prefix-open-tie-a",
            status = "open",
            summary = keyword,
            recruitEnd = "2026-07-10",
            seq = 200,
        )
        val openTieB = saveCampaign(
            id = "$prefix-open-tie-b",
            status = "open",
            summary = keyword,
            recruitEnd = "2026-07-10",
            seq = 200,
        )
        val openOlder = saveCampaign(
            id = "$prefix-open-older",
            status = "open",
            summary = keyword,
            recruitEnd = "2026-07-10",
            seq = 100,
        )
        val upcomingEarlier = saveCampaign(
            id = "$prefix-upcoming",
            status = "upcoming",
            summary = keyword,
            recruitEnd = "2026-06-01",
            seq = 300,
        )

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("sort", "deadline")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[*].id") {
                value(Matchers.contains(openEarly, openTieA, openTieB, openOlder, upcomingEarlier))
            }
        }
    }

    @Test
    fun `deadline은 status와 availableOnly 필터 및 pagination metadata를 유지한다`() {
        val keyword = marker("deadline-filter")
        val availableEarly = saveCampaign(
            status = "open",
            summary = keyword,
            capacity = 3,
            joined = 1,
            recruitEnd = "2026-07-20",
        )
        val availableLate = saveCampaign(
            status = "open",
            summary = keyword,
            capacity = 3,
            joined = 2,
            recruitEnd = "2026-07-31",
        )
        saveCampaign(
            status = "open",
            summary = keyword,
            capacity = 3,
            joined = 3,
            recruitEnd = "2026-07-16",
        )
        saveCampaign(status = "upcoming", summary = keyword, recruitEnd = "2026-05-01")

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("status", "open")
            param("availableOnly", "true")
            param("sort", "deadline")
            param("size", "1")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].id") { value(availableEarly) }
            jsonPath("$.totalElements") { value(2) }
            jsonPath("$.totalPages") { value(2) }
        }

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("status", "open")
            param("availableOnly", "true")
            param("sort", "deadline")
            param("page", "1")
            param("size", "1")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].id") { value(availableLate) }
        }
    }

    @Test
    fun `deadline과 recruitState 조합은 정렬과 pagination metadata를 유지한다`() {
        val keyword = marker("deadline-recruit-state")
        val early = saveCampaign(
            status = "open",
            summary = keyword,
            recruitStart = "2026-07-01",
            recruitEnd = "2026-07-20",
        )
        val late = saveCampaign(
            status = "open",
            summary = keyword,
            recruitStart = "2026-07-01",
            recruitEnd = "2026-07-31",
        )
        saveCampaign(
            status = "open",
            summary = keyword,
            recruitStart = "2026-07-01",
            recruitEnd = "2026-07-14",
        )

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("recruitState", "recruiting")
            param("sort", "deadline")
            param("size", "1")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].id") { value(early) }
            jsonPath("$.totalElements") { value(2) }
            jsonPath("$.totalPages") { value(2) }
        }
        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("recruitState", "recruiting")
            param("sort", "deadline")
            param("page", "1")
            param("size", "1")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].id") { value(late) }
        }
    }

    @Test
    fun `비정상 legacy 종료일이 남아 있어도 deadline 검색은 500이 아니다`() {
        val keyword = marker("deadline-legacy")
        saveCampaign(summary = keyword, recruitEnd = "legacy-date")
        saveCampaign(summary = keyword, recruitEnd = "2026-07-01")

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("sort", "deadline")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(2) }
            jsonPath("$.content.length()") { value(2) }
        }
    }

    @Test
    fun `잘못된 sort는 400`() {
        mvc.get("/api/campaigns/search") { param("sort", "closing-soon") }
            .andExpect { status { isBadRequest() } }
    }

    @Test
    fun `page와 size 경계를 검증한다`() {
        mvc.get("/api/campaigns/search") { param("page", "-1") }
            .andExpect { status { isBadRequest() } }
        mvc.get("/api/campaigns/search") { param("size", "0") }
            .andExpect { status { isBadRequest() } }
        mvc.get("/api/campaigns/search") { param("size", "51") }
            .andExpect { status { isBadRequest() } }
        mvc.get("/api/campaigns/search") { param("size", "1") }
            .andExpect { status { isOk() } }
        mvc.get("/api/campaigns/search") { param("size", "50") }
            .andExpect { status { isOk() } }
    }

    @Test
    fun `totalElements와 totalPages가 정확하고 범위 밖 page는 비어 있다`() {
        val keyword = marker("paging")
        repeat(5) { index -> saveCampaign(title = "$keyword $index", seq = index.toLong()) }

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("page", "1")
            param("size", "2")
        }.andExpect {
            status { isOk() }
            jsonPath("$.page") { value(1) }
            jsonPath("$.size") { value(2) }
            jsonPath("$.totalElements") { value(5) }
            jsonPath("$.totalPages") { value(3) }
            jsonPath("$.content.length()") { value(2) }
        }
        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("page", "3")
            param("size", "2")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(5) }
            jsonPath("$.totalPages") { value(3) }
            jsonPath("$.content.length()") { value(0) }
        }
    }

    @Test
    fun `비로그인 검색은 사용자별 상태가 모두 false`() {
        val keyword = marker("anonymous")
        saveCampaign(title = keyword, authorUserId = 1)

        mvc.get("/api/campaigns/search") { param("q", keyword) }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].recruitState") { value("recruiting") }
            jsonPath("$.content[0].recruitable") { value(true) }
            jsonPath("$.content[0].joinedByMe") { value(false) }
            jsonPath("$.content[0].ownedByMe") { value(false) }
        }
    }

    @Test
    fun `로그인 검색은 실제 참여와 소유 상태를 반영한다`() {
        val keyword = marker("viewer")
        val id = saveCampaign(title = keyword, authorUserId = 1)
        participantRepo.saveAndFlush(CampaignParticipant("cp-${UUID.randomUUID()}", id, 1))

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            headers { add("Authorization", "Bearer $token") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].joinedByMe") { value(true) }
            jsonPath("$.content[0].ownedByMe") { value(true) }
            jsonPath("$.content[0].authorUserId") { doesNotExist() }
        }
    }

    @Test
    fun `현재 page 밖 참가 상태는 현재 page 결과에 섞이지 않는다`() {
        val keyword = marker("page-state")
        val first = saveCampaign(title = keyword, seq = 200)
        val second = saveCampaign(title = keyword, seq = 100)
        participantRepo.saveAndFlush(CampaignParticipant("cp-${UUID.randomUUID()}", second, 1))

        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("size", "1")
            headers { add("Authorization", "Bearer $token") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].id") { value(first) }
            jsonPath("$.content[0].joinedByMe") { value(false) }
        }
        mvc.get("/api/campaigns/search") {
            param("q", keyword)
            param("page", "1")
            param("size", "1")
            headers { add("Authorization", "Bearer $token") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].id") { value(second) }
            jsonPath("$.content[0].joinedByMe") { value(true) }
        }
    }

    @Test
    fun `검색 특수문자는 LIKE wildcard가 아니라 일반 문자로 처리한다`() {
        val prefix = marker("literal")
        val percent = saveCampaign(title = "$prefix%percent")
        val underscore = saveCampaign(title = "${prefix}_underscore")
        val backslash = saveCampaign(title = "$prefix\\backslash")
        saveCampaign(title = "${prefix}Xpercent")
        saveCampaign(title = "${prefix}Xunderscore")

        listOf("$prefix%" to percent, "${prefix}_" to underscore, "$prefix\\" to backslash).forEach { (query, id) ->
            mvc.get("/api/campaigns/search") { param("q", query) }.andExpect {
                status { isOk() }
                jsonPath("$.totalElements") { value(1) }
                jsonPath("$.content[0].id") { value(id) }
            }
        }
    }

    @Test
    fun `기존 목록 배열 계약을 유지하고 search를 id로 오인하지 않는다`() {
        val arrayResponse = mvc.get("/api/campaigns").andExpect {
            status { isOk() }
            jsonPath("$") { isArray() }
        }.andReturn().response.contentAsString
        assertThat(arrayResponse).startsWith("[")

        mvc.get("/api/campaigns/search").andExpect {
            status { isOk() }
            jsonPath("$.content") { isArray() }
            jsonPath("$.page") { value(0) }
        }
    }
}

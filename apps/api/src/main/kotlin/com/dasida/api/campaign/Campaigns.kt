package com.dasida.api.campaign

import com.dasida.api.common.Photos
import com.dasida.api.post.Author
import com.dasida.api.security.AuthUser
import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.format.DateTimeParseException
import java.util.UUID

data class CampaignBody(val heading: String, val paragraphs: List<String>, val images: List<String>)

@Entity
@Table(name = "campaigns")
class Campaign(
    @Id val id: String,
    val status: String, // "open" | "upcoming" | "closed"
    val title: String,
    @Column(columnDefinition = "TEXT") val summary: String,
    val thumb: String,
    val recruitStart: String,
    val recruitEnd: String,
    val runStart: String,
    val runEnd: String,
    val capacity: Int,
    @Column(name = "joined_count") val joined: Int,
    val daysLeftLabel: String,
    @Embedded val author: Author,
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "json") val body: CampaignBody,
    @JsonIgnore var seq: Long = 0, // 정렬용. 시드=인덱스, 생성=epoch millis (최신이 위로)
)

interface CampaignRepository : JpaRepository<Campaign, String>

/**
 * 초기 적재 시드. apps/web/src/data/campaigns.ts 와 1:1 미러. SeedRunner 가 비어있을 때만 저장.
 */
object CampaignSeed {
    private val fashion = Photos.fashion
    private val nature = Photos.nature
    private val workshop = Photos.workshop
    private val market = Photos.market
    private val obj = Photos.obj
    private val people = Photos.people

    private val longBody = listOf(
        "버려진 폐자전거의 부품을 업사이클링하여 디자인 소품을 만듭니다. 수익금은 자전거 기부에 사용됩니다.",
        "참여자에게는 작업 도구와 재료가 제공되며, 워크숍은 총 4주간 진행됩니다.",
        "함께 만든 결과물은 지역 도서관과 청소년 센터에 기부되어 다시 새로운 이야기를 만들어 갑니다.",
    )

    val campaigns: List<Campaign> = listOf(
        Campaign("c1", "open", "강아지를 위한 업사이클링 댕교복",
            "버려진 의류를 활용해 반려견용 의류를 제작하고 보호소에 기부합니다.", fashion[1],
            "2026.06.18", "2026.07.18", "2026.07.22", "2026.08.20", 40, 39, "21일 남음",
            Author("김다시", true),
            CampaignBody("캠페인 소개", longBody, listOf(fashion[0], fashion[2]))),
        Campaign("c2", "open", "한강공원 플로깅 데이",
            "달리면서 줍는 환경 캠페인. 토요일 오전 두 시간.", people[0],
            "2026.06.10", "2026.06.30", "2026.07.05", "2026.07.05", 60, 47, "5일 남음",
            Author("한강러너스", true),
            CampaignBody("캠페인 소개", longBody, listOf(people[2], people[4]))),
        Campaign("c3", "upcoming", "도시 텃밭 워크숍",
            "재활용 화분으로 시작하는 작은 텃밭 클래스.", nature[1],
            "2026.07.01", "2026.07.20", "2026.07.25", "2026.08.25", 30, 0, "3일 후 모집 시작",
            Author("서울도시농부", false),
            CampaignBody("캠페인 소개", longBody, listOf(nature[3], nature[5]))),
        Campaign("c4", "upcoming", "헌 옷 기증 마켓",
            "잠든 옷장을 깨워 다시 입을 곳으로.", market[1],
            "2026.07.15", "2026.08.05", "2026.08.10", "2026.08.11", 100, 0, "12일 후 모집 시작",
            Author("리룸", true),
            CampaignBody("캠페인 소개", longBody, listOf(market[3], market[5]))),
        Campaign("c5", "closed", "폐현수막으로 만드는 에코백",
            "선거철 현수막의 두 번째 인생.", workshop[0],
            "2026.04.01", "2026.04.30", "2026.05.10", "2026.05.30", 40, 40, "모집완료",
            Author("김다시", true),
            CampaignBody("캠페인 결과", longBody, listOf(workshop[3], workshop[5]))),
        Campaign("c6", "closed", "커피박 비누 만들기",
            "버려지는 커피 찌꺼기로 만드는 친환경 비누.", obj[1],
            "2026.03.10", "2026.03.30", "2026.04.05", "2026.04.20", 25, 25, "모집완료",
            Author("원두모음", false),
            CampaignBody("캠페인 결과", longBody, listOf(obj[2], obj[4]))),
        Campaign("c7", "open", "유리병 캔들 메이킹",
            "다 쓴 유리병에 향을 담아 다시.", obj[0],
            "2026.06.20", "2026.07.10", "2026.07.15", "2026.07.30", 20, 12, "14일 남음",
            Author("보틀앤캔들", true),
            CampaignBody("캠페인 소개", longBody, listOf(obj[3], obj[5]))),
        Campaign("c8", "open", "버려진 가구로 만드는 작은 의자",
            "친구와 함께하는 목공 업사이클.", workshop[2],
            "2026.06.01", "2026.07.01", "2026.07.10", "2026.07.31", 16, 9, "8일 남음",
            Author("리메이크목공방", false),
            CampaignBody("캠페인 소개", longBody, listOf(workshop[4], workshop[6]))),
    )
}

data class CreateCampaignRequest(
    val title: String,
    val summary: String = "",
    val body: String = "",
    val thumb: String = "",
    val recruitStart: String = "",
    val recruitEnd: String = "",
    val runStart: String = "",
    val runEnd: String = "",
    val capacity: Int = 0,
)

@RestController
@RequestMapping("/api/campaigns")
class CampaignController(private val repo: CampaignRepository) {
    @GetMapping
    fun list(): List<Campaign> = repo.findAll(Sort.by(Sort.Direction.DESC, "seq"))

    @GetMapping("/{id}")
    fun get(@PathVariable id: String): Campaign =
        repo.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $id not found")
        }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@RequestBody req: CreateCampaignRequest, @AuthenticationPrincipal user: AuthUser): Campaign {
        val title = req.title.trim()
        if (title.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "title is required")
        if (req.capacity <= 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "capacity must be positive")
        if (req.capacity > MAX_CAPACITY) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "capacity is too large")

        // 날짜는 ISO yyyy-MM-dd 만 허용. 프론트가 <input type=date> 로 보냄.
        val recruitStart = parseDateOrBadRequest(req.recruitStart, "recruitStart")
        val recruitEnd = parseDateOrBadRequest(req.recruitEnd, "recruitEnd")
        val runStart = parseDateOrBadRequest(req.runStart, "runStart")
        val runEnd = parseDateOrBadRequest(req.runEnd, "runEnd")
        if (recruitStart.isAfter(recruitEnd)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "recruitStart must be on or before recruitEnd")
        }
        if (runStart.isAfter(runEnd)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "runStart must be on or before runEnd")
        }

        return repo.save(
            Campaign(
                id = "c-${UUID.randomUUID()}",
                status = "upcoming",
                title = title,
                summary = req.summary.trim(),
                thumb = req.thumb.trim(),
                recruitStart = recruitStart.toString(),
                recruitEnd = recruitEnd.toString(),
                runStart = runStart.toString(),
                runEnd = runEnd.toString(),
                capacity = req.capacity,
                joined = 0,
                daysLeftLabel = "모집예정",
                author = Author(user.name, user.verified),
                body = CampaignBody("캠페인 소개", listOf(req.body.trim()).filter { it.isNotBlank() }, emptyList()),
                seq = System.currentTimeMillis(),
            ),
        )
    }

    private fun parseDateOrBadRequest(value: String, field: String): LocalDate {
        if (value.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "$field is required")
        return try {
            LocalDate.parse(value.trim())
        } catch (_: DateTimeParseException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "$field must be yyyy-MM-dd")
        }
    }

    companion object {
        private const val MAX_CAPACITY = 10000
    }
}

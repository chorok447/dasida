package com.dasida.api.campaign

import com.dasida.api.auth.UserRepository
import com.dasida.api.common.Photos
import com.dasida.api.notification.NotificationService
import com.dasida.api.notification.NotificationType
import com.dasida.api.post.Author
import com.dasida.api.post.PostRepository
import com.dasida.api.security.AuthUser
import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.LockModeType
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Clock
import java.time.LocalDate
import java.util.UUID

data class CampaignBody(val heading: String, val paragraphs: List<String>, val images: List<String>)

@Entity
@Table(
    name = "campaigns",
    indexes = [Index(name = "idx_campaigns_author_user_id", columnList = "author_user_id")],
)
class Campaign(
    @Id val id: String,
    var status: String, // "open" | "upcoming" | "closed"
    var title: String,
    @Column(columnDefinition = "TEXT") var summary: String,
    var thumb: String,
    var recruitStart: String,
    var recruitEnd: String,
    var runStart: String,
    var runEnd: String,
    var capacity: Int,
    @Column(name = "joined_count") var joined: Int,
    var daysLeftLabel: String,
    @Embedded val author: Author,
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "json") var body: CampaignBody,
    @JsonIgnore var seq: Long = 0, // 정렬용. 시드=인덱스, 생성=epoch millis (최신이 위로)
    // 소유권 판정용. author.name 은 작성 시점의 표시 이름 snapshot 으로만 사용한다.
    // 시드/기존 캠페인은 null 을 허용하며 이름으로 소유자를 추정하지 않는다.
    @Column(name = "author_user_id")
    @JsonIgnore
    val authorUserId: Long? = null,
)

interface CampaignRepository : JpaRepository<Campaign, String> {
    /** 정원 동시성 방어용 write lock 조회. join 트랜잭션에서 가장 먼저 호출해 캠페인별로 직렬화. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Campaign c where c.id = :id")
    fun findByIdForUpdate(@Param("id") id: String): Campaign?

    fun findAllByIdInOrderBySeqDesc(ids: Collection<String>): List<Campaign>
    fun findByAuthorUserIdOrderBySeqDesc(authorUserId: Long): List<Campaign>
    fun findByAuthorUserId(authorUserId: Long, pageable: Pageable): Page<Campaign>
}

/** 캠페인 참여자. (campaign_id, user_id) unique 로 중복 참여를 막는다. */
@Entity
@Table(
    name = "campaign_participants",
    uniqueConstraints = [UniqueConstraint(columnNames = ["campaign_id", "user_id"])],
    indexes = [Index(name = "idx_campaign_participants_user_id", columnList = "user_id")],
)
class CampaignParticipant(
    @Id val id: String,
    @Column(name = "campaign_id") val campaignId: String,
    @Column(name = "user_id") val userId: Long,
)

interface CampaignParticipantRepository : JpaRepository<CampaignParticipant, String> {
    fun existsByCampaignIdAndUserId(campaignId: String, userId: Long): Boolean
    fun findByCampaignIdAndUserId(campaignId: String, userId: Long): CampaignParticipant?
    fun findByIdAndCampaignId(id: String, campaignId: String): CampaignParticipant?
    fun findByUserIdAndCampaignIdIn(userId: Long, campaignIds: Collection<String>): List<CampaignParticipant>
    fun findByUserId(userId: Long): List<CampaignParticipant>
    fun findByUserId(userId: Long, pageable: Pageable): Page<CampaignParticipant>
    fun findByCampaignId(campaignId: String, pageable: Pageable): Page<CampaignParticipant>
    fun countByCampaignId(campaignId: String): Long

    @Transactional
    fun deleteByCampaignId(campaignId: String)
}

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
            "2026-06-18", "2026-07-18", "2026-07-22", "2026-08-20", 40, 39, "21일 남음",
            Author("김다시", true),
            CampaignBody("캠페인 소개", longBody, listOf(fashion[0], fashion[2]))),
        Campaign("c2", "open", "한강공원 플로깅 데이",
            "달리면서 줍는 환경 캠페인. 토요일 오전 두 시간.", people[0],
            "2026-06-10", "2026-06-30", "2026-07-05", "2026-07-05", 60, 47, "5일 남음",
            Author("한강러너스", true),
            CampaignBody("캠페인 소개", longBody, listOf(people[2], people[4]))),
        Campaign("c3", "upcoming", "도시 텃밭 워크숍",
            "재활용 화분으로 시작하는 작은 텃밭 클래스.", nature[1],
            "2026-07-01", "2026-07-20", "2026-07-25", "2026-08-25", 30, 0, "3일 후 모집 시작",
            Author("서울도시농부", false),
            CampaignBody("캠페인 소개", longBody, listOf(nature[3], nature[5]))),
        Campaign("c4", "upcoming", "헌 옷 기증 마켓",
            "잠든 옷장을 깨워 다시 입을 곳으로.", market[1],
            "2026-07-15", "2026-08-05", "2026-08-10", "2026-08-11", 100, 0, "12일 후 모집 시작",
            Author("리룸", true),
            CampaignBody("캠페인 소개", longBody, listOf(market[3], market[5]))),
        Campaign("c5", "closed", "폐현수막으로 만드는 에코백",
            "선거철 현수막의 두 번째 인생.", workshop[0],
            "2026-04-01", "2026-04-30", "2026-05-10", "2026-05-30", 40, 40, "모집완료",
            Author("김다시", true),
            CampaignBody("캠페인 결과", longBody, listOf(workshop[3], workshop[5]))),
        Campaign("c6", "closed", "커피박 비누 만들기",
            "버려지는 커피 찌꺼기로 만드는 친환경 비누.", obj[1],
            "2026-03-10", "2026-03-30", "2026-04-05", "2026-04-20", 25, 25, "모집완료",
            Author("원두모음", false),
            CampaignBody("캠페인 결과", longBody, listOf(obj[2], obj[4]))),
        Campaign("c7", "open", "유리병 캔들 메이킹",
            "다 쓴 유리병에 향을 담아 다시.", obj[0],
            "2026-06-20", "2026-07-10", "2026-07-15", "2026-07-30", 20, 12, "14일 남음",
            Author("보틀앤캔들", true),
            CampaignBody("캠페인 소개", longBody, listOf(obj[3], obj[5]))),
        Campaign("c8", "open", "버려진 가구로 만드는 작은 의자",
            "친구와 함께하는 목공 업사이클.", workshop[2],
            "2026-06-01", "2026-07-01", "2026-07-10", "2026-07-31", 16, 9, "8일 남음",
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

data class UpdateCampaignRequest(
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

data class UpdateCampaignStatusRequest(
    val status: String,
)

data class CampaignParticipantResponse(
    val participantId: String,
    val name: String,
    val verified: Boolean,
)

data class CampaignParticipantsResponse(
    val campaignId: String,
    val title: String,
    val status: String,
    val capacity: Int,
    val joined: Int,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
    val participants: List<CampaignParticipantResponse>,
)

/** 참가자 퇴장 결과. 갱신된 joined 를 함께 반환하고 participant.userId 는 노출하지 않는다. */
data class CampaignParticipantRemovalResponse(
    val campaignId: String,
    val participantId: String,
    val removed: Boolean,
    val joined: Int,
)

/** Campaign 응답. 참여·소유 상태는 현재 요청 사용자 기준이며 authorUserId 자체는 노출하지 않는다. */
data class CampaignResponse(
    val id: String,
    val status: String,
    val title: String,
    val summary: String,
    val thumb: String,
    val recruitStart: String,
    val recruitEnd: String,
    val runStart: String,
    val runEnd: String,
    val capacity: Int,
    val joined: Int,
    val daysLeftLabel: String,
    val recruitable: Boolean,
    val recruitState: String,
    val author: Author,
    val body: CampaignBody,
    val joinedByMe: Boolean,
    val ownedByMe: Boolean,
)

data class CampaignSearchResponse(
    val content: List<CampaignResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

/** 마이페이지 캠페인 목록(참여/개설) pagination 응답. Spring Page 를 직접 노출하지 않는다. */
data class CampaignPageResponse(
    val content: List<CampaignResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

@RestController
@RequestMapping("/api/campaigns")
class CampaignController(
    private val repo: CampaignRepository,
    private val campaignSearch: CampaignSearchRepository,
    private val participants: CampaignParticipantRepository,
    private val comments: CampaignCommentRepository,
    private val posts: PostRepository,
    private val users: UserRepository,
    private val notifications: NotificationService,
    private val clock: Clock,
) {
    @GetMapping
    fun list(@AuthenticationPrincipal user: AuthUser?): List<CampaignResponse> {
        val campaigns = repo.findAll(Sort.by(Sort.Direction.DESC, "seq"))
        // N+1 회피: 내가 참여한 campaignId 를 한 번에 조회.
        val joinedIds = if (user == null || campaigns.isEmpty()) {
            emptySet()
        } else {
            participants.findByUserIdAndCampaignIdIn(user.id, campaigns.map { it.id }).map { it.campaignId }.toSet()
        }
        return campaigns.map { it.toResponse(viewerId = user?.id, joinedByMe = it.id in joinedIds) }
    }

    /** 공개 검색. content/count는 Querydsl로 분리하고 현재 page의 참여 상태만 bulk 조회한다. */
    @GetMapping("/search")
    @Transactional(readOnly = true)
    fun search(
        @RequestParam(name = "q", required = false) q: String?,
        @RequestParam(required = false) status: String?,
        @RequestParam(required = false) recruitState: String?,
        @RequestParam(defaultValue = "false") availableOnly: Boolean,
        @RequestParam(defaultValue = "latest") sort: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "9") size: Int,
        @AuthenticationPrincipal user: AuthUser?,
    ): CampaignSearchResponse {
        if (page < 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "page must not be negative")
        if (size < 1 || size > MAX_SEARCH_PAGE_SIZE) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be between 1 and $MAX_SEARCH_PAGE_SIZE")
        }

        val query = q?.trim()?.takeIf { it.isNotEmpty() }
        if (query != null && query.length > MAX_SEARCH_QUERY_LENGTH) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "q must not exceed $MAX_SEARCH_QUERY_LENGTH characters",
            )
        }
        if (status != null && status !in CAMPAIGN_STATUSES) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid campaign status")
        }
        val recruitStateFilter = when (recruitState) {
            null -> null
            "before_recruit" -> CampaignRecruitState.BEFORE_RECRUIT
            "recruiting" -> CampaignRecruitState.RECRUITING
            "ended" -> CampaignRecruitState.ENDED
            "closed" -> CampaignRecruitState.CLOSED
            else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid campaign recruitState")
        }
        val searchSort = when (sort) {
            "latest" -> CampaignSearchSort.LATEST
            "popular" -> CampaignSearchSort.POPULAR
            "deadline" -> CampaignSearchSort.DEADLINE
            else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid campaign sort")
        }

        val result = campaignSearch.search(
            CampaignSearchCondition(
                query = query,
                status = status,
                recruitState = recruitStateFilter,
                availableOnly = availableOnly,
                today = LocalDate.now(clock).toString(),
                sort = searchSort,
                page = page,
                size = size,
            ),
        )
        val joinedIds = if (user == null || result.content.isEmpty()) {
            emptySet()
        } else {
            participants.findByUserIdAndCampaignIdIn(user.id, result.content.map { it.id })
                .map { it.campaignId }
                .toSet()
        }

        return CampaignSearchResponse(
            content = result.content.map {
                it.toResponse(viewerId = user?.id, joinedByMe = it.id in joinedIds)
            },
            page = page,
            size = size,
            totalElements = result.totalElements,
            totalPages = totalPages(result.totalElements, size),
        )
    }

    /**
     * 현재 사용자가 참여한 캠페인 목록. 인증 필수.
     * 1) participant 조회(user_id 인덱스) → campaignId 목록 추출
     * 2) campaign IN 조회(seq DESC) → N+1 없이 2쿼리 완료
     * 삭제된 캠페인의 orphan participant 는 자동으로 결과에서 제외.
     */
    @GetMapping("/joined")
    fun joined(@AuthenticationPrincipal user: AuthUser): List<CampaignResponse> {
        val campaignIds = participants.findByUserId(user.id).map { it.campaignId }
        if (campaignIds.isEmpty()) return emptyList()
        return repo.findAllByIdInOrderBySeqDesc(campaignIds)
            .map { it.toResponse(viewerId = user.id, joinedByMe = true) }
    }

    /** 현재 사용자가 개설한 캠페인. 캠페인과 참여 상태를 각각 bulk 조회해 N+1을 피한다. */
    @GetMapping("/mine")
    fun mine(@AuthenticationPrincipal user: AuthUser): List<CampaignResponse> {
        val campaigns = repo.findByAuthorUserIdOrderBySeqDesc(user.id)
        if (campaigns.isEmpty()) return emptyList()

        val joinedIds = participants.findByUserIdAndCampaignIdIn(user.id, campaigns.map { it.id })
            .map { it.campaignId }
            .toSet()
        return campaigns.map {
            it.toResponse(viewerId = user.id, joinedByMe = it.id in joinedIds)
        }
    }

    /**
     * 참여 캠페인 pagination. participant row 를 id ASC(deterministic, 참여 일시 없음)로 page 한 뒤
     * 해당 page 의 campaignId 만 bulk 조회하고 participant page 순서를 보존한다. 삭제된 캠페인의 orphan 은 제외.
     */
    @GetMapping("/joined/page")
    @Transactional(readOnly = true)
    fun joinedPage(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "9") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignPageResponse {
        validatePageParams(page, size)
        val participantPage = participants.findByUserId(user.id, PageRequest.of(page, size, Sort.by("id").ascending()))
        val campaignIds = participantPage.content.map { it.campaignId }
        val byId = if (campaignIds.isEmpty()) emptyMap() else repo.findAllById(campaignIds).associateBy { it.id }
        val ordered = campaignIds.mapNotNull { byId[it] } // participant page 순서 보존, orphan 제외
        return CampaignPageResponse(
            content = ordered.map { it.toResponse(viewerId = user.id, joinedByMe = true) },
            page = page,
            size = size,
            totalElements = participantPage.totalElements,
            totalPages = totalPages(participantPage.totalElements, size),
        )
    }

    /** 개설 캠페인 pagination. 최신순(seq DESC, id). 현재 page 의 id 만 대상으로 참여 상태 bulk 조회. */
    @GetMapping("/mine/page")
    @Transactional(readOnly = true)
    fun minePage(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "9") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignPageResponse {
        validatePageParams(page, size)
        val result = repo.findByAuthorUserId(
            user.id,
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "seq").and(Sort.by("id"))),
        )
        val joinedIds = joinedByPage(user.id, result.content.map { it.id })
        return CampaignPageResponse(
            content = result.content.map { it.toResponse(viewerId = user.id, joinedByMe = it.id in joinedIds) },
            page = page,
            size = size,
            totalElements = result.totalElements,
            totalPages = totalPages(result.totalElements, size),
        )
    }

    @GetMapping("/{id}")
    fun get(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser?): CampaignResponse {
        val campaign = repo.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $id not found")
        }
        return campaign.toResponse(
            viewerId = user?.id,
            joinedByMe = user != null && participants.existsByCampaignIdAndUserId(id, user.id),
        )
    }

    /** 개설자용 참가자 목록. 참가자 page와 사용자 bulk 조회만 수행하며 campaign row lock은 사용하지 않는다. */
    @GetMapping("/{id}/participants")
    @Transactional(readOnly = true)
    fun participants(
        @PathVariable id: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignParticipantsResponse {
        if (page < 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "page must not be negative")
        if (size < 1 || size > MAX_PARTICIPANT_PAGE_SIZE) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be between 1 and $MAX_PARTICIPANT_PAGE_SIZE")
        }

        val campaign = repo.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $id not found")
        }
        if (campaign.authorUserId == null || campaign.authorUserId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the campaign owner")
        }

        val participantPage = participants.findByCampaignId(
            id,
            PageRequest.of(page, size, Sort.by("userId").ascending().and(Sort.by("id").ascending())),
        )
        val userIds = participantPage.content.map { it.userId }.distinct()
        val usersById = if (userIds.isEmpty()) {
            emptyMap()
        } else {
            users.findAllById(userIds).associateBy { requireNotNull(it.id) }
        }

        return CampaignParticipantsResponse(
            campaignId = campaign.id,
            title = campaign.title,
            status = campaign.status,
            capacity = campaign.capacity,
            joined = campaign.joined,
            page = participantPage.number,
            size = participantPage.size,
            totalElements = participantPage.totalElements,
            totalPages = participantPage.totalPages,
            participants = participantPage.content.map { participant ->
                val participantUser = usersById[participant.userId]
                CampaignParticipantResponse(
                    participantId = participant.id,
                    name = participantUser?.name ?: "탈퇴한 사용자",
                    verified = participantUser?.verified ?: false,
                )
            },
        )
    }

    /**
     * 개설자용 참가자 강제 퇴장. open 캠페인에서만, 개설자만 가능.
     *
     * 잠금 순서는 join/leave/status/delete 와 동일하게 campaign row write lock 을 가장 먼저 잡아
     * 같은 캠페인의 참여·취소·마감·삭제·강제퇴장을 직렬화한다. participant row 존재 여부만으로
     * joined 를 정확히 한 번만 감소시키며(0 미만 방지), 제거된 사용자에게 같은 트랜잭션에서 알림을 만든다.
     * - 캠페인 없음 404, 비개설자/레거시(authorUserId=null) 403, open 아니면 409, participant 없음 404.
     */
    @DeleteMapping("/{id}/participants/{participantId}")
    @Transactional
    fun removeParticipant(
        @PathVariable id: String,
        @PathVariable participantId: String,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignParticipantRemovalResponse {
        val campaign = repo.findByIdForUpdate(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $id not found")
        if (campaign.authorUserId == null || campaign.authorUserId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the campaign owner")
        }
        if (campaign.status != "open") {
            throw ResponseStatusException(HttpStatus.CONFLICT, "campaign is not open")
        }
        // 다른 캠페인의 participantId 거나 이미 제거됐으면 null → 404. 상태 검사 뒤라 status 를 비개설자에게 노출하지 않는다.
        val participant = participants.findByIdAndCampaignId(participantId, id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "participant $participantId not found")

        participants.delete(participant)
        campaign.joined = maxOf(0, campaign.joined - 1)
        repo.save(campaign)
        // 제거된 사용자에게 알림(개설자가 자기 자신을 제거한 경우에도 생성).
        notifications.notifyUser(
            recipientUserId = participant.userId,
            type = NotificationType.CAMPAIGN_PARTICIPATION_REMOVED,
            title = "참여 중인 캠페인에서 제외되었습니다",
            body = campaign.title,
            href = "/campaigns/$id",
        )
        return CampaignParticipantRemovalResponse(
            campaignId = id,
            participantId = participantId,
            removed = true,
            joined = campaign.joined,
        )
    }

    /**
     * 캠페인 참여. 인증 필요. 신규 참여는 open·모집 기간·정원을 모두 검증한다.
     *
     * 동시성: 트랜잭션 안에서 캠페인 row 를 가장 먼저 write lock 으로 잡아, 같은 캠페인에 대한 요청을 직렬화한다.
     * 이렇게 하면 (1) 서로 다른 유저가 마지막 자리에 동시에 들어와도 capacity 를 넘지 않고,
     * (2) 같은 유저의 동시 요청도 lock 보유 중 existsBy 재확인으로 idempotent 하게 처리된다.
     * unique 제약은 최종 방어선으로 유지(rollback-only 예외를 삼켜 200 으로 위장하지 않는다).
     */
    @PostMapping("/{id}/join")
    @Transactional
    fun join(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): CampaignResponse {
        val campaign = repo.findByIdForUpdate(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $id not found")
        // lock 보유 상태에서 재확인 → 같은 유저 동시 요청도 직렬화되어 idempotent.
        if (participants.existsByCampaignIdAndUserId(id, user.id)) {
            return campaign.toResponse(viewerId = user.id, joinedByMe = true)
        }
        if (campaign.status != "open") {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "campaign is not open")
        }
        val recruitment = campaign.recruitmentOn(LocalDate.now(clock))
        if (!recruitment.validDates) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "campaign recruit dates are invalid")
        }
        if (recruitment.state == CampaignRecruitState.BEFORE_RECRUIT) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "campaign recruitment has not started")
        }
        if (recruitment.state == CampaignRecruitState.ENDED) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "campaign recruitment has ended")
        }
        if (campaign.joined >= campaign.capacity) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "campaign is full")
        }
        participants.save(CampaignParticipant("cp-${UUID.randomUUID()}", id, user.id))
        campaign.joined += 1
        repo.save(campaign)
        // 새 participant 가 실제로 생성된 경로에서만 알림 → 멱등 join(위 early return)은 중복 생성 안 함.
        notifications.notify(
            recipientUserId = campaign.authorUserId,
            actorUserId = user.id,
            type = NotificationType.CAMPAIGN_JOINED,
            title = "${user.name}님이 캠페인에 참여했습니다",
            body = campaign.title,
            href = "/campaigns/$id/participants",
        )
        return campaign.toResponse(viewerId = user.id, joinedByMe = true)
    }

    /**
     * 캠페인 참여 취소. join 과 같은 campaign row lock 을 가장 먼저 잡아 참여·취소·마감을 직렬화한다.
     *
     * count 조회 후 감소하지 않고, 해당 사용자의 participant row 존재 여부만으로 정확히 한 번만 감소시킨다.
     * - participant 가 없으면 캠페인 상태와 무관하게 멱등 200(joinedByMe=false). 중복 취소도 추가 감소 없음.
     * - participant 가 있는데 open 이 아니면 409(마감 후 취소 불가, 비정상 upcoming participant 도 동일).
     * joined 는 0 미만으로 내려가지 않는다. 개설자가 직접 참여한 경우도 동일하게 처리한다.
     */
    @DeleteMapping("/{id}/join")
    @Transactional
    fun leave(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): CampaignResponse {
        val campaign = repo.findByIdForUpdate(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $id not found")
        val participant = participants.findByCampaignIdAndUserId(id, user.id)
            ?: return campaign.toResponse(viewerId = user.id, joinedByMe = false)
        if (campaign.status != "open") {
            throw ResponseStatusException(HttpStatus.CONFLICT, "campaign is not open")
        }
        participants.delete(participant)
        campaign.joined = maxOf(0, campaign.joined - 1)
        repo.save(campaign)
        return campaign.toResponse(viewerId = user.id, joinedByMe = false)
    }

    /**
     * 캠페인 모집 상태 변경. join 과 같은 row lock 을 가장 먼저 잡아 참여·마감 요청을 직렬화한다.
     * upcoming → open → closed 단방향 전환만 허용하며 같은 상태 요청은 멱등 처리한다.
     */
    @PutMapping("/{id}/status")
    @Transactional
    fun updateStatus(
        @PathVariable id: String,
        @RequestBody req: UpdateCampaignStatusRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignResponse {
        val campaign = repo.findByIdForUpdate(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $id not found")
        if (campaign.authorUserId == null || campaign.authorUserId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the campaign owner")
        }

        val target = req.status
        if (target != "open" && target != "closed") {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid campaign status")
        }

        if (campaign.status != target) {
            when {
                campaign.status == "upcoming" && target == "open" -> {
                    campaign.status = "open"
                    campaign.daysLeftLabel = "모집중"
                }
                campaign.status == "open" && target == "closed" -> {
                    campaign.status = "closed"
                    campaign.daysLeftLabel = "모집완료"
                }
                else -> throw ResponseStatusException(HttpStatus.CONFLICT, "invalid status transition")
            }
        }

        return campaign.toResponse(
            viewerId = user.id,
            joinedByMe = participants.existsByCampaignIdAndUserId(id, user.id),
        )
    }

    /** 모집 시작 전 캠페인 수정. 상태 변경과 같은 row lock 을 가장 먼저 잡아 요청을 직렬화한다. */
    @PutMapping("/{id}")
    @Transactional
    fun update(
        @PathVariable id: String,
        @RequestBody req: UpdateCampaignRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignResponse {
        val campaign = repo.findByIdForUpdate(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $id not found")
        if (campaign.authorUserId == null || campaign.authorUserId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the campaign owner")
        }
        if (campaign.status != "upcoming") {
            throw ResponseStatusException(HttpStatus.CONFLICT, "only upcoming campaigns can be updated")
        }

        val input = normalize(req)
        campaign.title = input.title
        campaign.summary = input.summary
        campaign.thumb = input.thumb
        campaign.recruitStart = input.recruitStart
        campaign.recruitEnd = input.recruitEnd
        campaign.runStart = input.runStart
        campaign.runEnd = input.runEnd
        campaign.capacity = input.capacity
        campaign.body = input.body

        return campaign.toResponse(
            viewerId = user.id,
            joinedByMe = participants.existsByCampaignIdAndUserId(id, user.id),
        )
    }

    /**
     * 모집 예정 캠페인 삭제. 개설자만, status=upcoming 이고 참여자·연결 게시글이 없을 때만 허용한다.
     *
     * 잠금 순서는 다른 캠페인 변경 API(join/status/update)와 같이 campaign row lock 을 가장 먼저 잡아
     * 같은 캠페인의 삭제·참여·수정·모집시작을 직렬화한다. 연결 게시글 존재 확인도 이 lock 안에서 하므로,
     * 게시글 생성(campaign write lock 보유)과 동시에 실행돼도 둘 중 하나만 통과해 orphan campaignId 가 남지 않는다.
     * soft delete 미도입 → 이미 지워진 캠페인을 다시 삭제하면 404.
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    fun delete(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser) {
        val campaign = repo.findByIdForUpdate(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $id not found")
        if (campaign.authorUserId == null || campaign.authorUserId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the campaign owner")
        }
        if (campaign.status != "upcoming") {
            throw ResponseStatusException(HttpStatus.CONFLICT, "only upcoming campaigns can be deleted")
        }
        // 참여 카운터와 participant row 가 불일치해도 둘 중 하나라도 0 이 아니면 삭제를 거부한다.
        if (campaign.joined != 0 || participants.countByCampaignId(id) != 0L) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "campaign has participants")
        }
        if (posts.existsByCampaignId(id)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "campaign has linked posts")
        }
        comments.deleteByCampaignId(id)
        repo.delete(campaign)
    }

    private fun Campaign.toResponse(
        viewerId: Long?,
        joinedByMe: Boolean = false,
    ): CampaignResponse {
        val recruitment = recruitmentOn(LocalDate.now(clock))
        return CampaignResponse(
            id = id, status = status, title = title, summary = summary, thumb = thumb,
            recruitStart = canonicalCampaignDateOrOriginal(recruitStart),
            recruitEnd = canonicalCampaignDateOrOriginal(recruitEnd),
            runStart = canonicalCampaignDateOrOriginal(runStart),
            runEnd = canonicalCampaignDateOrOriginal(runEnd),
            capacity = capacity, joined = joined, daysLeftLabel = recruitment.daysLeftLabel,
            recruitable = recruitment.recruitable, recruitState = recruitment.state.value,
            author = author, body = body, joinedByMe = joinedByMe,
            ownedByMe = authorUserId != null && authorUserId == viewerId,
        )
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@RequestBody req: CreateCampaignRequest, @AuthenticationPrincipal user: AuthUser): CampaignResponse {
        val input = normalize(req)

        return repo.save(
            Campaign(
                id = "c-${UUID.randomUUID()}",
                status = "upcoming",
                title = input.title,
                summary = input.summary,
                thumb = input.thumb,
                recruitStart = input.recruitStart,
                recruitEnd = input.recruitEnd,
                runStart = input.runStart,
                runEnd = input.runEnd,
                capacity = input.capacity,
                joined = 0,
                daysLeftLabel = "모집예정",
                author = Author(user.name, user.verified),
                body = input.body,
                seq = System.currentTimeMillis(),
                authorUserId = user.id,
            ),
        ).toResponse(viewerId = user.id, joinedByMe = false)
    }

    private data class NormalizedCampaignInput(
        val title: String,
        val summary: String,
        val body: CampaignBody,
        val thumb: String,
        val recruitStart: String,
        val recruitEnd: String,
        val runStart: String,
        val runEnd: String,
        val capacity: Int,
    )

    private fun normalize(req: CreateCampaignRequest) = normalize(
        title = req.title,
        summary = req.summary,
        body = req.body,
        thumb = req.thumb,
        recruitStartValue = req.recruitStart,
        recruitEndValue = req.recruitEnd,
        runStartValue = req.runStart,
        runEndValue = req.runEnd,
        capacity = req.capacity,
    )

    private fun normalize(req: UpdateCampaignRequest) = normalize(
        title = req.title,
        summary = req.summary,
        body = req.body,
        thumb = req.thumb,
        recruitStartValue = req.recruitStart,
        recruitEndValue = req.recruitEnd,
        runStartValue = req.runStart,
        runEndValue = req.runEnd,
        capacity = req.capacity,
    )

    /** 생성·수정이 반드시 같은 검증과 정규화 규칙을 사용하도록 한 곳에서 처리한다. */
    private fun normalize(
        title: String,
        summary: String,
        body: String,
        thumb: String,
        recruitStartValue: String,
        recruitEndValue: String,
        runStartValue: String,
        runEndValue: String,
        capacity: Int,
    ): NormalizedCampaignInput {
        val normalizedTitle = title.trim()
        if (normalizedTitle.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "title is required")
        }
        if (capacity <= 0) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "capacity must be positive")
        }
        if (capacity > MAX_CAPACITY) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "capacity is too large")
        }

        // ISO와 legacy 점 표기를 strict parsing한 뒤 저장 값은 ISO로 통일한다.
        val recruitStart = parseDateOrBadRequest(recruitStartValue, "recruitStart")
        val recruitEnd = parseDateOrBadRequest(recruitEndValue, "recruitEnd")
        val runStart = parseDateOrBadRequest(runStartValue, "runStart")
        val runEnd = parseDateOrBadRequest(runEndValue, "runEnd")
        if (recruitStart.isAfter(recruitEnd)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "recruitStart must be on or before recruitEnd")
        }
        if (recruitEnd.isAfter(runStart)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "recruitEnd must be on or before runStart")
        }
        if (runStart.isAfter(runEnd)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "runStart must be on or before runEnd")
        }

        val normalizedBody = body.trim()
        return NormalizedCampaignInput(
            title = normalizedTitle,
            summary = summary.trim(),
            body = CampaignBody("캠페인 소개", listOf(normalizedBody).filter { it.isNotBlank() }, emptyList()),
            thumb = thumb.trim(),
            recruitStart = recruitStart.toString(),
            recruitEnd = recruitEnd.toString(),
            runStart = runStart.toString(),
            runEnd = runEnd.toString(),
            capacity = capacity,
        )
    }

    private fun parseDateOrBadRequest(value: String, field: String) = parseCampaignDate(value, field)

    private fun validatePageParams(page: Int, size: Int) {
        if (page < 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "page must not be negative")
        if (size < 1 || size > MAX_SEARCH_PAGE_SIZE) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be between 1 and $MAX_SEARCH_PAGE_SIZE")
        }
    }

    /** 현재 page 의 campaignId 만 대상으로 참여 상태 bulk 조회. 빈 page 면 query 생략. */
    private fun joinedByPage(userId: Long, campaignIds: List<String>): Set<String> =
        if (campaignIds.isEmpty()) {
            emptySet()
        } else {
            participants.findByUserIdAndCampaignIdIn(userId, campaignIds).map { it.campaignId }.toSet()
        }

    companion object {
        private val CAMPAIGN_STATUSES = setOf("open", "upcoming", "closed")
        private const val MAX_CAPACITY = 10000
        private const val MAX_PARTICIPANT_PAGE_SIZE = 100
        private const val MAX_SEARCH_PAGE_SIZE = 50
        private const val MAX_SEARCH_QUERY_LENGTH = 100

        private fun totalPages(totalElements: Long, size: Int): Int =
            if (totalElements == 0L) 0 else ((totalElements - 1) / size + 1).toInt()
    }
}

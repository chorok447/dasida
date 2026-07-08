package com.dasida.api.campaign

import com.dasida.api.auth.UserRepository
import com.dasida.api.common.checkPageParams
import com.dasida.api.common.SitemapIdsResponse
import com.dasida.api.notification.NotificationService
import com.dasida.api.notification.NotificationType
import com.dasida.api.post.Author
import com.dasida.api.post.PostRepository
import com.dasida.api.security.AuthUser
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/**
 * 캠페인 도메인 서비스. 목록/검색/상세, 작성/수정/삭제, 모집 상태 변경, 내 캠페인/참여 캠페인 정책을 담당한다.
 * Controller 에서 옮겨온 validation, 날짜 정규화, 소유권 판정, 모집 상태 전이, N+1 회피 bulk 조회, row lock, 트랜잭션을 이 계층에 둔다.
 */
@Service
class CampaignService(
    private val repo: CampaignRepository,
    private val campaignSearch: CampaignSearchRepository,
    private val users: UserRepository,
    private val participants: CampaignParticipantRepository,
    private val bookmarkRepo: CampaignBookmarkRepository,
    private val posts: PostRepository,
    private val comments: CampaignCommentRepository,
    private val proofs: CampaignProofRepository,
    private val clock: Clock,
    private val notifications: NotificationService,
) {
    @Transactional(readOnly = true)
    fun listCampaigns(currentUserId: Long?): List<CampaignResponse> {
        val today = LocalDate.now(clock)
        val campaigns = repo.findByHiddenAtIsNull(Sort.by(Sort.Direction.DESC, "seq"))
        // N+1 회피: 내가 참여·북마크한 campaignId 를 각각 한 번에 조회.
        val joinedIds = joinedByPage(currentUserId, campaigns.map { it.id })
        val bookmarkedIds = bookmarkedByPage(currentUserId, campaigns.map { it.id })
        return campaigns.map {
            it.toResponse(
                viewerId = currentUserId,
                joinedByMe = it.id in joinedIds,
                bookmarkedByMe = it.id in bookmarkedIds,
                today = today,
            )
        }
    }

    /** sitemap 전용 id 목록. JSON 본문 없이 id 만 페이지 단위로 반환한다. */
    @Transactional(readOnly = true)
    fun listSitemapIds(page: Int, size: Int): SitemapIdsResponse {
        checkPageParams(page, size, MAX_SITEMAP_PAGE_SIZE)
        val result = repo.findIds(PageRequest.of(page, size))
        return SitemapIdsResponse(
            ids = result.content,
            page = page,
            size = size,
            totalElements = result.totalElements,
            totalPages = totalPages(result.totalElements, size),
        )
    }

    /** 공개 검색. content/count는 Querydsl로 분리하고 현재 page의 참여 상태만 bulk 조회한다. */
    @Transactional(readOnly = true)
    fun searchCampaigns(
        currentUserId: Long?,
        q: String?,
        status: String?,
        recruitState: String?,
        availableOnly: Boolean,
        sort: String,
        page: Int,
        size: Int,
        recruitEndFrom: String?,
        recruitEndTo: String?,
        runStartFrom: String?,
        runStartTo: String?,
    ): CampaignSearchResponse {
        checkPageParams(page, size, MAX_SEARCH_PAGE_SIZE)

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
        val normalizedRecruitEndFrom = normalizeOptionalCampaignSearchDate(recruitEndFrom, "recruitEndFrom")
        val normalizedRecruitEndTo = normalizeOptionalCampaignSearchDate(recruitEndTo, "recruitEndTo")
        val normalizedRunStartFrom = normalizeOptionalCampaignSearchDate(runStartFrom, "runStartFrom")
        val normalizedRunStartTo = normalizeOptionalCampaignSearchDate(runStartTo, "runStartTo")
        if (normalizedRecruitEndFrom != null &&
            normalizedRecruitEndTo != null &&
            normalizedRecruitEndFrom > normalizedRecruitEndTo
        ) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "recruitEndFrom must be on or before recruitEndTo",
            )
        }
        if (normalizedRunStartFrom != null &&
            normalizedRunStartTo != null &&
            normalizedRunStartFrom > normalizedRunStartTo
        ) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "runStartFrom must be on or before runStartTo",
            )
        }

        val today = LocalDate.now(clock)
        val result = campaignSearch.search(
            CampaignSearchCondition(
                query = query,
                status = status,
                recruitState = recruitStateFilter,
                availableOnly = availableOnly,
                recruitEndFrom = normalizedRecruitEndFrom,
                recruitEndTo = normalizedRecruitEndTo,
                runStartFrom = normalizedRunStartFrom,
                runStartTo = normalizedRunStartTo,
                today = today.toString(),
                sort = searchSort,
                page = page,
                size = size,
            ),
        )
        val joinedIds = joinedByPage(currentUserId, result.content.map { it.id })
        val bookmarkedIds = bookmarkedByPage(currentUserId, result.content.map { it.id })

        return CampaignSearchResponse(
            content = result.content.map {
                it.toResponse(
                    viewerId = currentUserId,
                    joinedByMe = it.id in joinedIds,
                    bookmarkedByMe = it.id in bookmarkedIds,
                    today = today,
                )
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
    @Transactional(readOnly = true)
    fun getJoinedCampaigns(userId: Long): List<CampaignResponse> {
        val today = LocalDate.now(clock)
        val campaignIds = participants.findByUserId(userId).map { it.campaignId }
        if (campaignIds.isEmpty()) return emptyList()
        val bookmarkedIds = bookmarkRepo.findByUserIdAndCampaignIdIn(userId, campaignIds).map { it.campaignId }.toSet()
        return repo.findAllByIdInAndHiddenAtIsNullOrderBySeqDesc(campaignIds)
            .map { it.toResponse(viewerId = userId, joinedByMe = true, bookmarkedByMe = it.id in bookmarkedIds, today = today) }
    }

    /** 현재 사용자가 개설한 캠페인. 캠페인과 참여 상태를 각각 bulk 조회해 N+1을 피한다. */
    @Transactional(readOnly = true)
    fun getMyCampaigns(userId: Long): List<CampaignResponse> {
        val today = LocalDate.now(clock)
        val campaigns = repo.findByAuthorUserIdAndDeletedAtIsNullOrderBySeqDesc(userId)
        if (campaigns.isEmpty()) return emptyList()

        val joinedIds = participants.findByUserIdAndCampaignIdIn(userId, campaigns.map { it.id })
            .map { it.campaignId }
            .toSet()
        val bookmarkedIds = bookmarkRepo.findByUserIdAndCampaignIdIn(userId, campaigns.map { it.id })
            .map { it.campaignId }
            .toSet()
        return campaigns.map {
            it.toResponse(
                viewerId = userId,
                joinedByMe = it.id in joinedIds,
                bookmarkedByMe = it.id in bookmarkedIds,
                today = today,
            )
        }
    }

    /**
     * 참여 캠페인 pagination. participant row 를 id ASC(deterministic, 참여 일시 없음)로 page 한 뒤
     * 해당 page 의 campaignId 만 bulk 조회하고 participant page 순서를 보존한다. 삭제된 캠페인의 orphan 은 제외.
     */
    @Transactional(readOnly = true)
    fun getJoinedCampaignsPage(userId: Long, page: Int, size: Int): CampaignPageResponse {
        validatePageParams(page, size)
        val today = LocalDate.now(clock)
        val participantPage = participants.findByUserId(userId, PageRequest.of(page, size, Sort.by("id").ascending()))
        val campaignIds = participantPage.content.map { it.campaignId }
        val byId = if (campaignIds.isEmpty()) emptyMap() else repo.findAllById(campaignIds).associateBy { it.id }
        // participant page 순서 보존, orphan·숨김 캠페인 제외
        val ordered = campaignIds.mapNotNull { byId[it] }.filter { it.hiddenAt == null }
        val bookmarkedIds = bookmarkedByPage(userId, ordered.map { it.id })
        return CampaignPageResponse(
            content = ordered.map {
                it.toResponse(viewerId = userId, joinedByMe = true, bookmarkedByMe = it.id in bookmarkedIds, today = today)
            },
            page = page,
            size = size,
            totalElements = participantPage.totalElements,
            totalPages = totalPages(participantPage.totalElements, size),
        )
    }

    /** 개설 캠페인 pagination. 최신순(seq DESC, id). 현재 page 의 id 만 대상으로 참여 상태 bulk 조회. */
    @Transactional(readOnly = true)
    fun getMyCampaignsPage(userId: Long, page: Int, size: Int): CampaignPageResponse {
        validatePageParams(page, size)
        val today = LocalDate.now(clock)
        val result = repo.findByAuthorUserIdAndDeletedAtIsNull(
            userId,
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "seq").and(Sort.by("id"))),
        )
        val joinedIds = joinedByPage(userId, result.content.map { it.id })
        val bookmarkedIds = bookmarkedByPage(userId, result.content.map { it.id })
        return CampaignPageResponse(
            content = result.content.map {
                it.toResponse(
                    viewerId = userId,
                    joinedByMe = it.id in joinedIds,
                    bookmarkedByMe = it.id in bookmarkedIds,
                    today = today,
                )
            },
            page = page,
            size = size,
            totalElements = result.totalElements,
            totalPages = totalPages(result.totalElements, size),
        )
    }

    @Transactional(readOnly = true)
    fun getCampaign(id: String, currentUserId: Long?): CampaignResponse {
        val campaign = repo.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $id not found")
        }
        // 삭제(soft delete)된 캠페인은 개설자에게도 존재하지 않는 것으로 취급한다.
        if (campaign.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $id not found")
        }
        // 숨김 캠페인은 개설자에게만 보인다(hidden 플래그 포함). 그 외에는 존재를 드러내지 않는 404.
        if (campaign.hiddenAt != null && (campaign.authorUserId == null || campaign.authorUserId != currentUserId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $id not found")
        }
        return campaign.toResponse(
            viewerId = currentUserId,
            joinedByMe = currentUserId != null && participants.existsByCampaignIdAndUserId(id, currentUserId),
            bookmarkedByMe = currentUserId != null && bookmarkRepo.existsByCampaignIdAndUserId(id, currentUserId),
            today = LocalDate.now(clock),
        )
    }

    /**
     * 캠페인 모집 상태 변경. join 과 같은 row lock 을 가장 먼저 잡아 참여·마감 요청을 직렬화한다.
     * upcoming → open → closed 단방향 전환만 허용하며 같은 상태 요청은 멱등 처리한다.
     */
    @Transactional
    fun updateStatus(userId: Long, campaignId: String, req: UpdateCampaignStatusRequest): CampaignResponse {
        val campaign = repo.findByIdForUpdate(campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        if (campaign.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }
        if (campaign.authorUserId == null || campaign.authorUserId != userId) {
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
            val title = if (target == "open") "모집이 시작되었습니다" else "모집이 마감되었습니다"
            participants.findByCampaignId(campaignId)
                .asSequence()
                .filter { it.userId != userId }
                .forEach { participant ->
                    val recipient = users.findById(participant.userId).orElse(null) ?: return@forEach
                    if (!recipient.notifyCampaignUpdates) return@forEach
                    notifications.notify(
                        recipientUserId = participant.userId,
                        actorUserId = userId,
                        type = NotificationType.CAMPAIGN_STATUS_CHANGED,
                        title = title,
                        body = campaign.title,
                        href = "/campaigns/$campaignId",
                    )
                }
        }

        return campaign.toResponse(
            viewerId = userId,
            joinedByMe = participants.existsByCampaignIdAndUserId(campaignId, userId),
            bookmarkedByMe = bookmarkRepo.existsByCampaignIdAndUserId(campaignId, userId),
            today = LocalDate.now(clock),
        )
    }

    /** 현재 사용자가 저장한 캠페인. 북마크/캠페인/참여를 각각 bulk 조회해 N+1을 피한다. */
    @Transactional(readOnly = true)
    fun getMyBookmarks(userId: Long): List<CampaignResponse> {
        val today = LocalDate.now(clock)
        val campaignIds = bookmarkRepo.findByUserId(userId).map { it.campaignId }.distinct()
        if (campaignIds.isEmpty()) return emptyList()

        val campaigns = repo.findAllByIdInAndHiddenAtIsNullOrderBySeqDesc(campaignIds)
        val joinedIds = participants.findByUserIdAndCampaignIdIn(userId, campaignIds)
            .map { it.campaignId }
            .toSet()
        return campaigns.map {
            it.toResponse(viewerId = userId, joinedByMe = it.id in joinedIds, bookmarkedByMe = true, today = today)
        }
    }

    /**
     * 저장한 캠페인 pagination. bookmark row 를 id ASC(deterministic, createdAt 없음)로 page 한 뒤
     * 해당 page 의 campaignId 만 bulk 조회하고 bookmark page 순서를 보존한다. 삭제된 캠페인의 orphan bookmark 는 제외.
     */
    @Transactional(readOnly = true)
    fun getMyBookmarksPage(userId: Long, page: Int, size: Int): CampaignPageResponse {
        validatePageParams(page, size)
        val today = LocalDate.now(clock)
        val bookmarkPage = bookmarkRepo.findByUserId(userId, PageRequest.of(page, size, Sort.by("id").ascending()))
        val campaignIds = bookmarkPage.content.map { it.campaignId }
        val campaignsById = if (campaignIds.isEmpty()) emptyMap() else repo.findAllById(campaignIds).associateBy { it.id }
        // bookmark page 순서 보존, orphan·숨김 캠페인 제외
        val ordered = campaignIds.mapNotNull { campaignsById[it] }.filter { it.hiddenAt == null }
        val joinedIds = joinedByPage(userId, ordered.map { it.id })
        return CampaignPageResponse(
            content = ordered.map {
                it.toResponse(viewerId = userId, joinedByMe = it.id in joinedIds, bookmarkedByMe = true, today = today)
            },
            page = page,
            size = size,
            totalElements = bookmarkPage.totalElements,
            totalPages = totalPages(bookmarkPage.totalElements, size),
        )
    }

    /** 북마크. 이미 저장된 경우에도 idempotent(200). */
    @Transactional
    fun bookmarkCampaign(userId: Long, campaignId: String): CampaignResponse {
        val campaign = visibleForUpdateOrNotFound(campaignId)
        if (!bookmarkRepo.existsByCampaignIdAndUserId(campaignId, userId)) {
            bookmarkRepo.save(CampaignBookmark("cbk-${UUID.randomUUID()}", campaignId, userId))
        }
        return campaign.toResponse(
            viewerId = userId,
            joinedByMe = participants.existsByCampaignIdAndUserId(campaignId, userId),
            bookmarkedByMe = true,
            today = LocalDate.now(clock),
        )
    }

    /** 북마크 취소. 저장되지 않은 경우에도 idempotent(200). */
    @Transactional
    fun unbookmarkCampaign(userId: Long, campaignId: String): CampaignResponse {
        val campaign = visibleForUpdateOrNotFound(campaignId)
        bookmarkRepo.findByCampaignIdAndUserId(campaignId, userId)?.let(bookmarkRepo::delete)
        return campaign.toResponse(
            viewerId = userId,
            joinedByMe = participants.existsByCampaignIdAndUserId(campaignId, userId),
            bookmarkedByMe = false,
            today = LocalDate.now(clock),
        )
    }

    /** 모집 시작 전 캠페인 수정. 상태 변경과 같은 row lock 을 가장 먼저 잡아 요청을 직렬화한다. */
    @Transactional
    fun updateCampaign(userId: Long, campaignId: String, req: UpdateCampaignRequest): CampaignResponse {
        val campaign = repo.findByIdForUpdate(campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        if (campaign.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }
        if (campaign.authorUserId == null || campaign.authorUserId != userId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the campaign owner")
        }
        if (campaign.status != "upcoming") {
            throw ResponseStatusException(HttpStatus.CONFLICT, "only upcoming campaigns can be updated")
        }

        val input = normalizeCampaignInput(
            req.title, req.summary, req.body, req.thumb,
            req.recruitStart, req.recruitEnd, req.runStart, req.runEnd, req.capacity,
        )
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
            viewerId = userId,
            joinedByMe = participants.existsByCampaignIdAndUserId(campaignId, userId),
            bookmarkedByMe = bookmarkRepo.existsByCampaignIdAndUserId(campaignId, userId),
            today = LocalDate.now(clock),
        )
    }

    @Transactional
    fun createCampaign(user: AuthUser, req: CreateCampaignRequest): CampaignResponse {
        val input = normalizeCampaignInput(
            req.title, req.summary, req.body, req.thumb,
            req.recruitStart, req.recruitEnd, req.runStart, req.runEnd, req.capacity,
        )

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
                author = Author(
                    user.name,
                    user.verified,
                    users.findById(user.id).orElse(null)?.profileImageUrl,
                ),
                body = input.body,
                seq = System.currentTimeMillis(),
                authorUserId = user.id,
            ),
        ).toResponse(viewerId = user.id, joinedByMe = false, bookmarkedByMe = false, today = LocalDate.now(clock))
    }

    /**
     * 모집 예정 캠페인 삭제. 개설자만, status=upcoming 이고 참여자·연결 게시글이 없을 때만 허용한다.
     *
     * 잠금 순서는 다른 캠페인 변경 API(join/status/update)와 같이 campaign row lock 을 가장 먼저 잡아
     * 같은 캠페인의 삭제·참여·수정·모집시작을 직렬화한다. 연결 게시글 존재 확인도 이 lock 안에서 하므로,
     * 게시글 생성(campaign write lock 보유)과 동시에 실행돼도 둘 중 하나만 통과해 orphan campaignId 가 남지 않는다.
     * soft delete 미도입 → 이미 지워진 캠페인을 다시 삭제하면 404.
     */
    @Transactional
    fun deleteCampaign(userId: Long, campaignId: String) {
        val campaign = repo.findByIdForUpdate(campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        if (campaign.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }
        if (campaign.authorUserId == null || campaign.authorUserId != userId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the campaign owner")
        }
        if (campaign.status != "upcoming") {
            throw ResponseStatusException(HttpStatus.CONFLICT, "only upcoming campaigns can be deleted")
        }
        // 참여 카운터와 participant row 가 불일치해도 둘 중 하나라도 0 이 아니면 삭제를 거부한다.
        if (campaign.joined != 0 || participants.countByCampaignId(campaignId) != 0L) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "campaign has participants")
        }
        if (posts.existsByCampaignId(campaignId)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "campaign has linked posts")
        }
        // soft delete: row 는 남기고 deletedAt/hiddenAt 을 마킹한다(신고 대상 보존·복구 여지).
        // 댓글/북마크 row 도 남긴다 — 공개 노출은 hiddenAt 재사용으로 이미 차단된다.
        val now = Instant.now(clock)
        campaign.deletedAt = now
        if (campaign.hiddenAt == null) campaign.hiddenAt = now
    }

    /**
     * 상호작용(북마크)용 write lock 조회. 숨김 캠페인은 존재를 드러내지 않는 404 로 차단한다
     * (개설자 권한 경로인 상태 변경/수정/삭제는 별도 — 숨김 상태에서도 허용).
     */
    private fun visibleForUpdateOrNotFound(campaignId: String): Campaign {
        val campaign = repo.findByIdForUpdate(campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        if (campaign.hiddenAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }
        return campaign
    }

    private fun validatePageParams(page: Int, size: Int) = checkPageParams(page, size, MAX_SEARCH_PAGE_SIZE)

    /** 현재 page 의 campaignId 만 대상으로 참여 상태 bulk 조회. 비로그인/빈 page 면 query 생략. */
    private fun joinedByPage(userId: Long?, campaignIds: List<String>): Set<String> =
        if (userId == null || campaignIds.isEmpty()) {
            emptySet()
        } else {
            participants.findByUserIdAndCampaignIdIn(userId, campaignIds).map { it.campaignId }.toSet()
        }

    /** 현재 page 의 campaignId 만 대상으로 북마크 bulk 조회. 비로그인/빈 page 면 query 생략. */
    private fun bookmarkedByPage(userId: Long?, campaignIds: List<String>): Set<String> =
        if (userId == null || campaignIds.isEmpty()) {
            emptySet()
        } else {
            bookmarkRepo.findByUserIdAndCampaignIdIn(userId, campaignIds).map { it.campaignId }.toSet()
        }

    private companion object {
        val CAMPAIGN_STATUSES = setOf("open", "upcoming", "closed")
        const val MAX_SEARCH_PAGE_SIZE = 50
        const val MAX_SEARCH_QUERY_LENGTH = 100
        const val MAX_SITEMAP_PAGE_SIZE = 500

        fun totalPages(totalElements: Long, size: Int): Int =
            if (totalElements == 0L) 0 else ((totalElements - 1) / size + 1).toInt()
    }
}

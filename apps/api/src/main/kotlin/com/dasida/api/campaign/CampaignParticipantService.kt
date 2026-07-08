package com.dasida.api.campaign

import com.dasida.api.auth.UserRepository
import com.dasida.api.common.checkPageParams
import com.dasida.api.notification.NotificationService
import com.dasida.api.notification.NotificationType
import com.dasida.api.security.AuthUser
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Clock
import java.time.LocalDate
import java.util.UUID

/**
 * 캠페인 참여 도메인 서비스. 참여/참여 취소, 참가자 목록/강제 퇴장 정책을 담당한다.
 * Controller 에서 옮겨온 참여 가능 검증, owner-only 검증, row lock, 알림 생성, 트랜잭션을 이 계층에 둔다.
 */
@Service
class CampaignParticipantService(
    private val repo: CampaignRepository,
    private val participants: CampaignParticipantRepository,
    private val bookmarkRepo: CampaignBookmarkRepository,
    private val users: UserRepository,
    private val notifications: NotificationService,
    private val clock: Clock,
) {
    /**
     * 캠페인 참여. 인증 필요. 신규 참여는 open·모집 기간·정원을 모두 검증한다.
     *
     * 동시성: 트랜잭션 안에서 캠페인 row 를 가장 먼저 write lock 으로 잡아, 같은 캠페인에 대한 요청을 직렬화한다.
     * 이렇게 하면 (1) 서로 다른 유저가 마지막 자리에 동시에 들어와도 capacity 를 넘지 않고,
     * (2) 같은 유저의 동시 요청도 lock 보유 중 existsBy 재확인으로 idempotent 하게 처리된다.
     * unique 제약은 최종 방어선으로 유지(rollback-only 예외를 삼켜 200 으로 위장하지 않는다).
     */
    @Transactional
    fun joinCampaign(user: AuthUser, campaignId: String): CampaignResponse {
        val today = LocalDate.now(clock)
        val campaign = repo.findByIdForUpdate(campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        // 숨김 캠페인은 신규 참여 불가(존재를 드러내지 않는 404). 참여 취소(leave)는 그대로 허용한다.
        if (campaign.hiddenAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }
        // lock 보유 상태에서 재확인 → 같은 유저 동시 요청도 직렬화되어 idempotent.
        if (participants.existsByCampaignIdAndUserId(campaignId, user.id)) {
            return campaign.toResponse(
                viewerId = user.id,
                joinedByMe = true,
                bookmarkedByMe = bookmarkRepo.existsByCampaignIdAndUserId(campaignId, user.id),
                today = today,
            )
        }
        if (campaign.status != "open") {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "campaign is not open")
        }
        val recruitment = campaign.recruitmentOn(today)
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
        participants.save(CampaignParticipant("cp-${UUID.randomUUID()}", campaignId, user.id))
        campaign.joined += 1
        repo.save(campaign)
        // 새 participant 가 실제로 생성된 경로에서만 알림 → 멱등 join(위 early return)은 중복 생성 안 함.
        notifications.notify(
            recipientUserId = campaign.authorUserId,
            actorUserId = user.id,
            type = NotificationType.CAMPAIGN_JOINED,
            title = "${user.name}님이 캠페인에 참여했습니다",
            body = campaign.title,
            href = "/campaigns/$campaignId/participants",
        )
        return campaign.toResponse(
            viewerId = user.id,
            joinedByMe = true,
            bookmarkedByMe = bookmarkRepo.existsByCampaignIdAndUserId(campaignId, user.id),
            today = today,
        )
    }

    /**
     * 캠페인 참여 취소. join 과 같은 campaign row lock 을 가장 먼저 잡아 참여·취소·마감을 직렬화한다.
     *
     * count 조회 후 감소하지 않고, 해당 사용자의 participant row 존재 여부만으로 정확히 한 번만 감소시킨다.
     * - participant 가 없으면 캠페인 상태와 무관하게 멱등 200(joinedByMe=false). 중복 취소도 추가 감소 없음.
     * - participant 가 있는데 open 이 아니면 409(마감 후 취소 불가, 비정상 upcoming participant 도 동일).
     * joined 는 0 미만으로 내려가지 않는다. 개설자가 직접 참여한 경우도 동일하게 처리한다.
     */
    @Transactional
    fun leaveCampaign(userId: Long, campaignId: String): CampaignResponse {
        val today = LocalDate.now(clock)
        val campaign = repo.findByIdForUpdate(campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        val participant = participants.findByCampaignIdAndUserId(campaignId, userId)
            ?: return campaign.toResponse(
                viewerId = userId,
                joinedByMe = false,
                bookmarkedByMe = bookmarkRepo.existsByCampaignIdAndUserId(campaignId, userId),
                today = today,
            )
        if (campaign.status != "open") {
            throw ResponseStatusException(HttpStatus.CONFLICT, "campaign is not open")
        }
        participants.delete(participant)
        campaign.joined = maxOf(0, campaign.joined - 1)
        repo.save(campaign)
        return campaign.toResponse(
            viewerId = userId,
            joinedByMe = false,
            bookmarkedByMe = bookmarkRepo.existsByCampaignIdAndUserId(campaignId, userId),
            today = today,
        )
    }

    /** 개설자용 참가자 목록. 참가자 page와 사용자 bulk 조회만 수행하며 campaign row lock은 사용하지 않는다. */
    @Transactional(readOnly = true)
    fun getParticipants(ownerUserId: Long, campaignId: String, page: Int, size: Int): CampaignParticipantsResponse {
        checkPageParams(page, size, MAX_PARTICIPANT_PAGE_SIZE)

        val campaign = repo.findById(campaignId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }
        if (campaign.authorUserId == null || campaign.authorUserId != ownerUserId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the campaign owner")
        }

        val participantPage = participants.findByCampaignId(
            campaignId,
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
    @Transactional
    fun removeParticipant(ownerUserId: Long, campaignId: String, participantId: String): CampaignParticipantRemovalResponse {
        val campaign = repo.findByIdForUpdate(campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        if (campaign.authorUserId == null || campaign.authorUserId != ownerUserId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the campaign owner")
        }
        if (campaign.status != "open") {
            throw ResponseStatusException(HttpStatus.CONFLICT, "campaign is not open")
        }
        // 다른 캠페인의 participantId 거나 이미 제거됐으면 null → 404. 상태 검사 뒤라 status 를 비개설자에게 노출하지 않는다.
        val participant = participants.findByIdAndCampaignId(participantId, campaignId)
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
            href = "/campaigns/$campaignId",
        )
        return CampaignParticipantRemovalResponse(
            campaignId = campaignId,
            participantId = participantId,
            removed = true,
            joined = campaign.joined,
        )
    }

    private companion object {
        const val MAX_PARTICIPANT_PAGE_SIZE = 100
    }
}

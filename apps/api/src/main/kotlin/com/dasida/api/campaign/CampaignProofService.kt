package com.dasida.api.campaign

import com.dasida.api.auth.UserRepository
import com.dasida.api.auth.findActiveOrThrow
import com.dasida.api.auth.toAuthorSnapshot
import com.dasida.api.common.checkPageParams
import com.dasida.api.notification.NotificationService
import com.dasida.api.notification.NotificationType
import com.dasida.api.post.normalizeImages
import com.dasida.api.security.AuthUser
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Clock
import java.time.Instant
import java.util.UUID

/**
 * 캠페인 참여 인증(후기) 도메인 서비스. 목록/작성/삭제 정책을 담당한다.
 * 작성은 참여자만, 모집 시작(upcoming 이후)부터, 1인 1인증. 개설자에게 알림을 보낸다.
 */
@Service
class CampaignProofService(
    private val campaigns: CampaignRepository,
    private val proofs: CampaignProofRepository,
    private val participants: CampaignParticipantRepository,
    private val users: UserRepository,
    private val notifications: NotificationService,
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun listProofs(campaignId: String, currentUserId: Long?, page: Int, size: Int): CampaignProofsResponse {
        checkPageParams(page, size, MAX_PAGE_SIZE)
        requireViewableCampaign(campaignId, currentUserId)

        val result = proofs.findByCampaignIdAndHiddenAtIsNull(
            campaignId,
            PageRequest.of(
                page,
                size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.asc("id")),
            ),
        )
        return CampaignProofsResponse(
            content = result.content.map { it.toResponse(currentUserId) },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
            proofedByMe = currentUserId != null &&
                proofs.existsByCampaignIdAndAuthorUserId(campaignId, currentUserId),
        )
    }

    @Transactional
    fun createProof(user: AuthUser, campaignId: String, request: CreateCampaignProofRequest): CampaignProofResponse {
        val text = request.text.trim()
        if (text.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "text is required")
        }
        if (text.length > MAX_TEXT_LENGTH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "text must not exceed $MAX_TEXT_LENGTH characters")
        }
        val images = normalizeImages(request.images)

        // 캠페인 삭제와 같은 row 를 첫 DB 조회로 잠가 orphan proof 생성을 막는다.
        val campaign = campaigns.findByIdForUpdate(campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        if (campaign.hiddenAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }
        if (campaign.status == "upcoming") {
            throw ResponseStatusException(HttpStatus.CONFLICT, "campaign has not started")
        }
        if (!participants.existsByCampaignIdAndUserId(campaignId, user.id)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not a campaign participant")
        }
        if (proofs.existsByCampaignIdAndAuthorUserId(campaignId, user.id)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "proof already exists")
        }

        val authorSnapshot = users.findActiveOrThrow(user.id).toAuthorSnapshot()
        val saved = proofs.save(
            CampaignProof(
                id = "cpr-${UUID.randomUUID()}",
                campaignId = campaignId,
                author = authorSnapshot,
                text = text,
                images = images,
                createdAt = Instant.now(clock),
                authorUserId = user.id,
            ),
        )
        // 내 캠페인에 타인이 인증 → 개설자에게 알림(본인 인증/개설자 미상은 helper 가 생략).
        notifications.notify(
            recipientUserId = campaign.authorUserId,
            actorUserId = user.id,
            type = NotificationType.CAMPAIGN_PROOF_CREATED,
            title = "${authorSnapshot.name}님이 캠페인 참여를 인증했습니다",
            body = campaign.title,
            href = "/campaigns/$campaignId?tab=proofs",
        )
        return saved.toResponse(user.id)
    }

    @Transactional
    fun deleteProof(userId: Long, campaignId: String, proofId: String) {
        // 작성·캠페인 삭제와 lock 순서를 맞추기 위해 campaign row 를 가장 먼저 잠근다.
        campaigns.findByIdForUpdate(campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        val proof = proofs.findByIdAndCampaignId(proofId, campaignId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "proof $proofId not found")
        // 숨김 인증은 작성자에게도 존재를 드러내지 않는다.
        if (proof.hiddenAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "proof $proofId not found")
        }
        if (proof.authorUserId != userId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not the proof owner")
        }
        proofs.delete(proof)
    }

    /** 공개 조회 경로에서 캠페인 존재·노출 여부 확인. 숨김 캠페인은 개설자에게만 보인다. */
    private fun requireViewableCampaign(campaignId: String, currentUserId: Long?) {
        val campaign = campaigns.findById(campaignId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }
        if (campaign.hiddenAt != null && (campaign.authorUserId == null || campaign.authorUserId != currentUserId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "campaign $campaignId not found")
        }
    }

    private companion object {
        const val MAX_PAGE_SIZE = 100
        const val MAX_TEXT_LENGTH = 500
    }
}

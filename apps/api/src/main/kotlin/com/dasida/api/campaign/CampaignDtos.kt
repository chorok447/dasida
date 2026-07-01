package com.dasida.api.campaign

import com.dasida.api.post.Author
import java.time.Instant

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

data class CampaignCommentResponse(
    val id: String,
    val campaignId: String,
    val author: Author,
    val text: String,
    val createdAt: Instant,
    val ownedByMe: Boolean,
    val edited: Boolean,
    val updatedAt: Instant?,
)

data class CampaignCommentsResponse(
    val content: List<CampaignCommentResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

data class CreateCampaignCommentRequest(val text: String)
data class UpdateCampaignCommentRequest(val text: String)

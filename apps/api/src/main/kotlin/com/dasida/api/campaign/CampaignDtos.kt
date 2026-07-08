package com.dasida.api.campaign

import com.dasida.api.post.Author
import io.swagger.v3.oas.annotations.media.Schema
import java.time.Instant

@Schema(description = "캠페인 작성 요청. 날짜는 yyyy-MM-dd 또는 yyyy.MM.dd 를 허용한다.")
data class CreateCampaignRequest(
    @field:Schema(description = "제목")
    val title: String,
    @field:Schema(description = "요약")
    val summary: String = "",
    @field:Schema(description = "본문")
    val body: String = "",
    @field:Schema(description = "썸네일 URL")
    val thumb: String = "",
    @field:Schema(description = "모집 시작일", example = "2026-07-01")
    val recruitStart: String = "",
    @field:Schema(description = "모집 종료일", example = "2026-07-10")
    val recruitEnd: String = "",
    @field:Schema(description = "진행 시작일", example = "2026-07-15")
    val runStart: String = "",
    @field:Schema(description = "진행 종료일", example = "2026-07-20")
    val runEnd: String = "",
    @field:Schema(description = "모집 정원", example = "20")
    val capacity: Int = 0,
)

@Schema(description = "캠페인 수정 요청. status 가 upcoming 일 때만 허용된다.")
data class UpdateCampaignRequest(
    @field:Schema(description = "제목")
    val title: String,
    @field:Schema(description = "요약")
    val summary: String = "",
    @field:Schema(description = "본문")
    val body: String = "",
    @field:Schema(description = "썸네일 URL")
    val thumb: String = "",
    @field:Schema(description = "모집 시작일", example = "2026-07-01")
    val recruitStart: String = "",
    @field:Schema(description = "모집 종료일", example = "2026-07-10")
    val recruitEnd: String = "",
    @field:Schema(description = "진행 시작일", example = "2026-07-15")
    val runStart: String = "",
    @field:Schema(description = "진행 종료일", example = "2026-07-20")
    val runEnd: String = "",
    @field:Schema(description = "모집 정원", example = "20")
    val capacity: Int = 0,
)

@Schema(description = "모집 상태 변경 요청")
data class UpdateCampaignStatusRequest(
    @field:Schema(description = "목표 상태", example = "open", allowableValues = ["upcoming", "open", "closed"])
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
    val bookmarkedByMe: Boolean,
    val ownedByMe: Boolean,
    // 관리자 숨김 여부. 숨김 콘텐츠는 개설자 본인 경로(mine/상세)에서만 응답에 실린다.
    val hidden: Boolean = false,
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
    val parentId: String? = null,
    // 최상위 댓글일 때만 채워지는 1단계 답글 목록(오래된 순).
    val replies: List<CampaignCommentResponse> = emptyList(),
)

data class CampaignCommentsResponse(
    val content: List<CampaignCommentResponse>,
    val page: Int,
    val size: Int,
    // pagination 은 최상위 댓글 기준.
    val totalElements: Long,
    val totalPages: Int,
    // 답글을 포함한 전체 노출 댓글 수(카운트 표시용).
    val totalComments: Long = 0,
)

data class CampaignProofResponse(
    val id: String,
    val campaignId: String,
    val author: Author,
    val text: String,
    val images: List<String>,
    val createdAt: Instant,
    val ownedByMe: Boolean,
)

data class CampaignProofsResponse(
    val content: List<CampaignProofResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
    // 현재 사용자가 이미 인증을 남겼는지(숨김 포함). 비로그인은 false.
    val proofedByMe: Boolean,
)

@Schema(description = "캠페인 참여 인증 작성 요청")
data class CreateCampaignProofRequest(
    @field:Schema(description = "인증 소감(최대 500자)")
    val text: String,
    @field:Schema(description = "인증 사진 URL 목록(최대 4장)")
    val images: List<String> = emptyList(),
)

@Schema(description = "캠페인 댓글 작성 요청")
data class CreateCampaignCommentRequest(
    @field:Schema(description = "댓글 본문(최대 500자)")
    val text: String,
    @field:Schema(description = "답글 대상 댓글 id(최상위 댓글만 가능). null 이면 일반 댓글.")
    val parentId: String? = null,
)

@Schema(description = "캠페인 댓글 수정 요청")
data class UpdateCampaignCommentRequest(
    @field:Schema(description = "댓글 본문(최대 500자)")
    val text: String,
)

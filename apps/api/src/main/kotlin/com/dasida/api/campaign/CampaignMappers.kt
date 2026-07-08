package com.dasida.api.campaign

import java.time.LocalDate

/** viewerId 기준 소유 여부와 today 기준 모집 상태를 한 곳에서 판정한다. authorUserId 는 노출하지 않는다. */
fun Campaign.toResponse(
    viewerId: Long?,
    joinedByMe: Boolean,
    bookmarkedByMe: Boolean,
    today: LocalDate,
): CampaignResponse {
    val recruitment = recruitmentOn(today)
    return CampaignResponse(
        id = id, status = status, title = title, summary = summary, thumb = thumb,
        recruitStart = canonicalCampaignDateOrOriginal(recruitStart),
        recruitEnd = canonicalCampaignDateOrOriginal(recruitEnd),
        runStart = canonicalCampaignDateOrOriginal(runStart),
        runEnd = canonicalCampaignDateOrOriginal(runEnd),
        capacity = capacity, joined = joined, daysLeftLabel = recruitment.daysLeftLabel,
        recruitable = recruitment.recruitable, recruitState = recruitment.state.value,
        author = author, body = body, joinedByMe = joinedByMe, bookmarkedByMe = bookmarkedByMe,
        ownedByMe = authorUserId != null && authorUserId == viewerId,
        hidden = hiddenAt != null,
    )
}

fun CampaignProof.toResponse(viewerId: Long?) = CampaignProofResponse(
    id = id,
    campaignId = campaignId,
    author = author,
    text = text,
    images = images,
    createdAt = createdAt,
    ownedByMe = authorUserId == viewerId,
)

fun CampaignComment.toResponse(viewerId: Long?, replies: List<CampaignCommentResponse> = emptyList()) = CampaignCommentResponse(
    id = id,
    campaignId = campaignId,
    author = author,
    text = text,
    createdAt = createdAt,
    ownedByMe = authorUserId != null && authorUserId == viewerId,
    edited = updatedAt != null,
    updatedAt = updatedAt,
    parentId = parentId,
    replies = replies,
)

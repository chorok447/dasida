package com.dasida.api.campaign

import java.time.LocalDate

/** viewerId 기준 소유 여부와 today 기준 모집 상태를 한 곳에서 판정한다. authorUserId 는 노출하지 않는다. */
fun Campaign.toResponse(
    viewerId: Long?,
    joinedByMe: Boolean,
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
        author = author, body = body, joinedByMe = joinedByMe,
        ownedByMe = authorUserId != null && authorUserId == viewerId,
    )
}

fun CampaignComment.toResponse(viewerId: Long?) = CampaignCommentResponse(
    id = id,
    campaignId = campaignId,
    author = author,
    text = text,
    createdAt = createdAt,
    ownedByMe = authorUserId != null && authorUserId == viewerId,
    edited = updatedAt != null,
    updatedAt = updatedAt,
)

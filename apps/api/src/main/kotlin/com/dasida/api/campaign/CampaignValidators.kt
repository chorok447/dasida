package com.dasida.api.campaign

import com.dasida.api.common.splitRichBodyHtml
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException

private const val MAX_CAPACITY = 10000
private const val MAX_COMMENT_TEXT_LENGTH = 500

data class NormalizedCampaignInput(
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

/** 생성·수정이 반드시 같은 검증과 정규화 규칙을 사용하도록 한 곳에서 처리한다. */
fun normalizeCampaignInput(
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
    val recruitStart = parseCampaignDate(recruitStartValue, "recruitStart")
    val recruitEnd = parseCampaignDate(recruitEndValue, "recruitEnd")
    val runStart = parseCampaignDate(runStartValue, "runStart")
    val runEnd = parseCampaignDate(runEndValue, "runEnd")
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
    val (paragraphHtml, imageUrls) = splitRichBodyHtml(normalizedBody)
    return NormalizedCampaignInput(
        title = normalizedTitle,
        summary = summary.trim(),
        body = CampaignBody("캠페인 소개", listOf(paragraphHtml).filter { it.isNotBlank() }, imageUrls),
        thumb = thumb.trim(),
        recruitStart = recruitStart.toString(),
        recruitEnd = recruitEnd.toString(),
        runStart = runStart.toString(),
        runEnd = runEnd.toString(),
        capacity = capacity,
    )
}

/** 캠페인 댓글 본문 trim + blank/length 검증. */
fun normalizeCampaignCommentText(value: String): String {
    val text = value.trim()
    if (text.isEmpty()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "text is required")
    if (text.length > MAX_COMMENT_TEXT_LENGTH) {
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "text must not exceed $MAX_COMMENT_TEXT_LENGTH characters")
    }
    return text
}

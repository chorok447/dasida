package com.dasida.api.campaign

import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.time.format.ResolverStyle
import java.time.temporal.ChronoUnit
import java.util.Locale

private val ISO_DATE_PATTERN = Regex("\\d{4}-\\d{2}-\\d{2}")
private val DOTTED_DATE_PATTERN = Regex("\\d{4}\\.\\d{2}\\.\\d{2}")
private val DOTTED_DATE_FORMATTER = DateTimeFormatter
    .ofPattern("uuuu.MM.dd", Locale.ROOT)
    .withResolverStyle(ResolverStyle.STRICT)

/** 생성·수정의 날짜 순서 검증에서 사용하는 공통 parser. */
internal fun parseCampaignDate(value: String, fieldName: String): LocalDate {
    val trimmed = value.trim()
    if (trimmed.isEmpty()) {
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "$fieldName is required")
    }

    return parseSupportedCampaignDate(trimmed)
        ?: throw ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "$fieldName must be yyyy-MM-dd or yyyy.MM.dd",
        )
}

/** 검색 파라미터는 canonical ISO 날짜만 허용하고 빈 값은 조건 없음으로 처리한다. */
internal fun normalizeOptionalCampaignSearchDate(value: String?, fieldName: String): String? {
    val trimmed = value?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    if (!ISO_DATE_PATTERN.matches(trimmed)) {
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "$fieldName must be yyyy-MM-dd")
    }

    return try {
        LocalDate.parse(trimmed, DateTimeFormatter.ISO_LOCAL_DATE).toString()
    } catch (_: DateTimeParseException) {
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "$fieldName must be a valid yyyy-MM-dd date")
    }
}

/** 지원하는 legacy 점 표기는 응답에서 canonical 형식으로 바꾸고 알 수 없는 값은 안전하게 유지한다. */
internal fun canonicalCampaignDateOrOriginal(value: String): String =
    parseSupportedCampaignDate(value.trim())?.toString() ?: value

enum class CampaignRecruitState(val value: String) {
    BEFORE_RECRUIT("before_recruit"),
    RECRUITING("recruiting"),
    ENDED("ended"),
    CLOSED("closed"),
}

internal data class CampaignRecruitment(
    val state: CampaignRecruitState,
    val recruitable: Boolean,
    val daysLeftLabel: String,
    val validDates: Boolean = true,
)

/** status와 모집 기간을 함께 평가한다. 알 수 없는 legacy 날짜는 안전하게 모집 종료로 취급한다. */
internal fun Campaign.recruitmentOn(today: LocalDate): CampaignRecruitment {
    if (status == "closed") {
        return CampaignRecruitment(CampaignRecruitState.CLOSED, false, "모집완료")
    }
    if (status == "upcoming") {
        return CampaignRecruitment(CampaignRecruitState.BEFORE_RECRUIT, false, "모집 예정")
    }

    val start = parseSupportedCampaignDate(recruitStart.trim())
    val end = parseSupportedCampaignDate(recruitEnd.trim())
    if (start == null || end == null || start.isAfter(end)) {
        return CampaignRecruitment(CampaignRecruitState.ENDED, false, "모집완료", validDates = false)
    }
    if (today.isBefore(start)) {
        return CampaignRecruitment(CampaignRecruitState.BEFORE_RECRUIT, false, "모집 예정")
    }
    if (today.isAfter(end)) {
        return CampaignRecruitment(CampaignRecruitState.ENDED, false, "모집완료")
    }

    val recruitable = joined < capacity
    val remainingDays = ChronoUnit.DAYS.between(today, end)
    val label = when {
        !recruitable -> "모집완료"
        remainingDays == 0L -> "오늘 마감"
        else -> "D-$remainingDays"
    }
    return CampaignRecruitment(CampaignRecruitState.RECRUITING, recruitable, label)
}

private fun parseSupportedCampaignDate(value: String): LocalDate? {
    val formatter = when {
        ISO_DATE_PATTERN.matches(value) -> DateTimeFormatter.ISO_LOCAL_DATE
        DOTTED_DATE_PATTERN.matches(value) -> DOTTED_DATE_FORMATTER
        else -> return null
    }

    return try {
        LocalDate.parse(value, formatter)
    } catch (_: DateTimeParseException) {
        null
    }
}

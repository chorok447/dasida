package com.dasida.api.campaign

import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.time.format.ResolverStyle
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

/** 지원하는 legacy 점 표기는 응답에서 canonical 형식으로 바꾸고 알 수 없는 값은 안전하게 유지한다. */
internal fun canonicalCampaignDateOrOriginal(value: String): String =
    parseSupportedCampaignDate(value.trim())?.toString() ?: value

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

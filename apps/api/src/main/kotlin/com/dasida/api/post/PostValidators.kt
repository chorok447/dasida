package com.dasida.api.post

import com.dasida.api.common.splitRichBodyHtml
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException

private const val MAX_TEXT_LENGTH = 1000
private const val MAX_TAGS = 10
private const val MAX_TAG_LENGTH = 30
private const val MAX_IMAGES = 4
private const val MAX_COMMENT_LENGTH = 500

/** 게시글 본문 trim + blank/length 검증. 생성·수정이 공유한다. */
fun normalizePostText(text: String): String {
    val trimmed = text.trim()
    if (trimmed.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "text is required")
    if (richTextPlainLength(trimmed) > MAX_TEXT_LENGTH) {
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "text is too long")
    }
    return trimmed
}

/** 본문 HTML 이미지를 images 배열로 옮긴 뒤 text·images 를 검증한다. */
fun normalizePostFields(text: String, images: List<String>): Pair<String, List<String>> {
    val (html, inlineImages) = splitRichBodyHtml(text.trim())
    val normalizedText = normalizePostText(html)
    val mergedImages = normalizeImages((images + inlineImages).distinct())
    return normalizedText to mergedImages
}

private fun richTextPlainLength(value: String): Int {
    if (!value.contains('<')) return value.length
    return value.replace(Regex("<[^>]*>"), "").trim().length
}

fun normalizeTags(tags: List<String>): List<String> {
    val normalized = tags
        .map { it.trim() }
        .filter { it.isNotBlank() }
        .map { if (it.startsWith("#")) it else "#$it" }
        .distinct()
    if (normalized.size > MAX_TAGS) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "too many tags")
    if (normalized.any { it.length > MAX_TAG_LENGTH }) {
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "tag is too long")
    }
    return normalized
}

fun normalizeImages(images: List<String>): List<String> {
    val normalized = images.map { it.trim() }.filter { it.isNotBlank() }.distinct()
    if (normalized.size > MAX_IMAGES) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "too many images")
    // 서버가 이미지를 fetch 하지 않으므로 SSRF 방어는 범위 밖. http(s) 형식만 최소 검증.
    if (normalized.any { !(it.startsWith("http://") || it.startsWith("https://")) }) {
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "image must be http(s) url")
    }
    return normalized
}

fun normalizeCommentText(value: String): String {
    val text = value.trim()
    if (text.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "comment is required")
    if (text.length > MAX_COMMENT_LENGTH) {
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "comment is too long")
    }
    return text
}

package com.dasida.api.common

private val imgSrcPattern = Regex("""<img[^>]+src=["'](https?://[^"']+)["']""", RegexOption.IGNORE_CASE)
private val imgTagPattern = Regex("""<img[^>]*>""", RegexOption.IGNORE_CASE)
private val emptyParagraphPattern = Regex("""<p>(?:\s|&nbsp;|<br\s*/?>)*</p>""", RegexOption.IGNORE_CASE)

/** img 제거 후 남는 빈 문단을 정리한다. */
fun cleanEmptyRichParagraphs(html: String): String {
    var next = html.trim()
    var prev = ""
    while (next != prev) {
        prev = next
        next = emptyParagraphPattern.replace(next, "").trim()
    }
    return next
}

/** 본문 HTML 에서 갤러리용 이미지 URL 을 분리한다. */
fun splitRichBodyHtml(body: String): Pair<String, List<String>> {
    val images = imgSrcPattern
        .findAll(body)
        .map { it.groupValues[1].trim() }
        .filter { it.isNotBlank() }
        .distinct()
        .toList()
    val withoutImages = cleanEmptyRichParagraphs(body.replace(imgTagPattern, ""))
    return withoutImages to images
}

package com.dasida.api.common

/** sitemap 전용 id 목록 페이지. 본문·상호작용 필드 없이 id 만 반환한다. */
data class SitemapIdsResponse(
    val ids: List<String>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

package com.dasida.api.common.ratelimit

import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpMethod
import org.springframework.stereotype.Component

@Component
class ContentWriteRateLimitFilter(
    rateLimitService: RateLimitService,
) : RateLimitFilterBase(rateLimitService) {
    override fun ruleFor(request: HttpServletRequest): RateLimitRule? {
        if (request.method != HttpMethod.POST.name()) return null
        val path = request.requestURI.removeSuffix("/")
        if (path == "/api/reports") return RateLimitRule.REPORT_CREATE
        if (path == "/api/media") return RateLimitRule.MEDIA_UPLOAD
        if (path == "/api/posts") return RateLimitRule.POST_CREATE
        if (path == "/api/campaigns") return RateLimitRule.CAMPAIGN_CREATE
        if (isCommentCreatePath(path)) return RateLimitRule.COMMENT_CREATE
        if (isViewRecordPath(path)) return RateLimitRule.VIEW_RECORD
        if (isInteractionPath(path)) return RateLimitRule.INTERACTION_TOGGLE
        return null
    }

    private fun isCommentCreatePath(path: String): Boolean {
        val segments = path.split("/").filter { it.isNotEmpty() }
        if (segments.size != 4) return false
        return segments[0] == "api" &&
            segments[1] in setOf("posts", "campaigns") &&
            // 참여 인증(proofs)도 댓글과 같은 작성 한도를 공유한다.
            segments[3] in setOf("comments", "proofs")
    }

    /** 좋아요·북마크·참여·팔로우·차단 토글 POST. 알림을 만들 수 있는 가벼운 상호작용을 하나의 한도로 묶는다. */
    private fun isInteractionPath(path: String): Boolean {
        val segments = path.split("/").filter { it.isNotEmpty() }
        return when (segments.size) {
            4 -> segments[0] == "api" && (
                (segments[1] in setOf("posts", "campaigns") && segments[3] in setOf("like", "bookmark", "join")) ||
                    (segments[1] == "users" && segments[3] in setOf("follow", "block"))
                )
            // 댓글 좋아요: /api/{posts|campaigns}/{id}/comments/{commentId}/like
            6 -> segments[0] == "api" && segments[1] in setOf("posts", "campaigns") &&
                segments[3] == "comments" && segments[5] == "like"
            else -> false
        }
    }

    /** 조회수 기록: POST /api/posts/{id}/views — 비로그인 공개 엔드포인트라 별도(더 느슨한) 한도를 쓴다. */
    private fun isViewRecordPath(path: String): Boolean {
        val segments = path.split("/").filter { it.isNotEmpty() }
        return segments.size == 4 && segments[0] == "api" && segments[1] == "posts" && segments[3] == "views"
    }
}

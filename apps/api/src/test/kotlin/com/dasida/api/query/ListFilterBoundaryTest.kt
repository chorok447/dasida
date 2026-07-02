package com.dasida.api.query

import com.dasida.api.auth.User
import com.dasida.api.notification.Notification
import com.dasida.api.notification.NotificationRepository
import com.dasida.api.notification.NotificationType
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

/**
 * 목록 조회 필터 포함/제외 경계 회귀 방지.
 *
 * 기존 테스트가 이미 고정하지 못한 **필터 경계 두 가지**만 좁게 보강한다.
 * 1. 게시글 검색 `campaignOnly` 는 기본값이 false 다. PostSearchControllerTest 는 `campaignOnly=true` 만 고정해
 *    필터 미지정/false 시 캠페인 비연결 게시글이 여전히 포함되는 기본 경계는 고정되지 않았다.
 * 2. 알림 `unreadOnly=true` 필터는 사용자별 격리와 교집합으로 적용된다. NotificationControllerTest 의 unreadOnly
 *    테스트는 내 알림만, 격리 테스트는 unreadOnly 없이 검증해 "다른 사용자의 안읽은 알림"이 unreadOnly 결과에
 *    섞이지 않는 경계는 고정되지 않았다.
 * (검색어/status/recruitState/availableOnly/날짜 범위 필터와 정렬은 Post/CampaignSearchControllerTest 및 PR #79 가
 *  이미 고정하므로 중복하지 않는다.)
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ListFilterBoundaryTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val posts: PostRepository,
    @param:Autowired private val notifications: NotificationRepository,
) {
    private val meToken = jwt.issue(User(id = 1, email = "me@test.com", passwordHash = "x", name = "나"))
    private val me = 1L
    private val other = 2L

    private fun savePost(text: String, campaignId: String?): String {
        val id = "flt-post-${UUID.randomUUID()}"
        posts.saveAndFlush(
            Post(
                id = id,
                author = Author("작성자", false),
                time = "방금",
                text = text,
                tags = emptyList(),
                images = emptyList(),
                likes = 0,
                comments = 0,
                campaignId = campaignId,
                seq = 1,
                authorUserId = 9,
            ),
        )
        return id
    }

    private fun saveNotification(userId: Long, read: Boolean): String {
        val id = "flt-noti-${UUID.randomUUID()}"
        notifications.saveAndFlush(
            Notification(
                id = id,
                userId = userId,
                type = NotificationType.POST_COMMENT_CREATED,
                title = "제목",
                body = "본문",
                href = "/posts/p1",
                readAt = if (read) Instant.now() else null,
                createdAt = Instant.now(),
                time = "방금 전",
                seq = System.nanoTime(),
            ),
        )
        return id
    }

    @Test
    fun `게시글 검색 campaignOnly 기본값은 캠페인 비연결 게시글도 포함한다`() {
        val keyword = "fltmark${UUID.randomUUID().toString().take(8)}"
        val linked = savePost(text = "$keyword 캠페인 글", campaignId = "c1")
        val unlinked = savePost(text = "$keyword 일반 글", campaignId = null)

        // 미지정 → 기본 false → 둘 다 포함.
        mvc.get("/api/posts/search") { param("q", keyword) }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(2) }
            jsonPath("$.content[?(@.id == '$linked')]") { exists() }
            jsonPath("$.content[?(@.id == '$unlinked')]") { exists() }
        }
        // 명시적 false → 둘 다 포함.
        mvc.get("/api/posts/search") {
            param("q", keyword)
            param("campaignOnly", "false")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(2) }
        }
    }

    @Test
    fun `알림 unreadOnly true는 다른 사용자의 안읽은 알림을 포함하지 않는다`() {
        val myUnread = saveNotification(me, read = false)
        saveNotification(me, read = true)
        saveNotification(other, read = false)

        mvc.get("/api/notifications") {
            headers { add("Authorization", "Bearer $meToken") }
            param("unreadOnly", "true")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(1) }
            jsonPath("$.content[0].id") { value(myUnread) }
            jsonPath("$.unreadCount") { value(1) }
        }
    }
}

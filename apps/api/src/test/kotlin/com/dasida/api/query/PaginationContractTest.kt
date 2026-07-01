package com.dasida.api.query

import com.dasida.api.auth.User
import com.dasida.api.campaign.Campaign
import com.dasida.api.campaign.CampaignBody
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.notification.Notification
import com.dasida.api.notification.NotificationRepository
import com.dasida.api.notification.NotificationType
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

/**
 * Page 응답의 **page 이동(content 분리) 계약** 회귀 방지.
 *
 * 각 도메인의 pagination 테스트는 page=1 요청의 `content.length` 와 metadata(page/size/totalElements/totalPages)를
 * 이미 고정하지만, page=0 과 page=1 을 함께 조회해 **두 page 의 content 가 겹치지 않고(disjoint) 합치면 전체를
 * 빠짐없이 덮는지**는 고정하지 않는다. Service 계층/PageRequest offset 이 리팩터링돼도 page 경계가 어긋나
 * 항목이 중복되거나 누락되지 않도록 대표 Page API 세 곳(게시글/캠페인/알림)에서 고정한다.
 * (metadata 필드 자체와 empty page, page/size validation 은 각 ControllerTest·PagePolicyTest 가 이미 고정하므로
 *  중복하지 않는다. 정렬은 PR #79, 필터는 PR #80 과 중복하지 않는다.)
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PaginationContractTest(
    @Autowired private val mvc: MockMvc,
    @Autowired private val mapper: ObjectMapper,
    @Autowired private val jwt: JwtService,
    @Autowired private val posts: PostRepository,
    @Autowired private val campaigns: CampaignRepository,
    @Autowired private val notifications: NotificationRepository,
) {
    private val me = 1L
    private val token = jwt.issue(User(id = me, email = "me@test.com", passwordHash = "x", name = "나"))

    private fun savePost(seq: Long): String {
        val id = "pgc-post-${UUID.randomUUID()}"
        posts.saveAndFlush(
            Post(
                id, Author("작성자", false), "방금", "본문", emptyList(), emptyList(), 0, 0,
                seq = seq, authorUserId = me,
            ),
        )
        return id
    }

    private fun saveCampaign(seq: Long): String {
        val id = "pgc-camp-${UUID.randomUUID()}"
        campaigns.saveAndFlush(
            Campaign(
                id, "open", "캠페인", "요약", "",
                "2026-07-01", "2026-07-31", "2026-08-01", "2026-08-31",
                10, 0, "모집중", Author("개설자", false),
                CampaignBody("소개", emptyList(), emptyList()),
                seq = seq, authorUserId = me,
            ),
        )
        return id
    }

    private fun saveNotification(seq: Long): String {
        val id = "pgc-noti-${UUID.randomUUID()}"
        notifications.saveAndFlush(
            Notification(
                id = id,
                userId = me,
                type = NotificationType.POST_COMMENT_CREATED,
                title = "제목",
                body = "본문",
                href = "/posts/p1",
                readAt = null,
                createdAt = Instant.now(),
                time = "방금 전",
                seq = seq,
            ),
        )
        return id
    }

    /** 지정 path 를 page/size 로 조회해 content[*].id 목록을 반환한다. */
    private fun pageIds(path: String, page: Int, size: Int): List<String> {
        val body = mvc.get(path) {
            headers { add("Authorization", "Bearer $token") }
            param("page", page.toString())
            param("size", size.toString())
        }.andReturn().response.contentAsString
        return mapper.readTree(body)["content"].map { it["id"].asText() }
    }

    /** 3개 항목을 size=2 로 나누면 page0(2개) + page1(1개) 이 disjoint 하고 합치면 전체를 덮는지 확인한다. */
    private fun assertPageSplit(path: String, allIds: Set<String>) {
        val page0 = pageIds(path, page = 0, size = 2)
        val page1 = pageIds(path, page = 1, size = 2)

        assertThat(page0).hasSize(2)
        assertThat(page1).hasSize(1)
        assertThat(page0).doesNotContainAnyElementsOf(page1)
        assertThat(page0 + page1).containsExactlyInAnyOrderElementsOf(allIds)
    }

    @Test
    fun `내 게시글 page는 page0과 page1 content가 겹치지 않고 전체를 덮는다`() {
        val ids = setOf(savePost(seq = 1), savePost(seq = 2), savePost(seq = 3))
        assertPageSplit("/api/posts/mine/page", ids)
    }

    @Test
    fun `내 개설 캠페인 page는 page0과 page1 content가 겹치지 않고 전체를 덮는다`() {
        val ids = setOf(saveCampaign(seq = 1), saveCampaign(seq = 2), saveCampaign(seq = 3))
        assertPageSplit("/api/campaigns/mine/page", ids)
    }

    @Test
    fun `내 알림 page는 page0과 page1 content가 겹치지 않고 전체를 덮는다`() {
        val ids = setOf(saveNotification(seq = 1), saveNotification(seq = 2), saveNotification(seq = 3))
        assertPageSplit("/api/notifications", ids)
    }
}

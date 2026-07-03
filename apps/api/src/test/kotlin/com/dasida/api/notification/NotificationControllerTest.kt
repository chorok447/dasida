package com.dasida.api.notification

import com.dasida.api.auth.User
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class NotificationControllerTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val repo: NotificationRepository,
) {
    private val meToken = jwt.issue(User(id = 1, email = "me@test.com", passwordHash = "x", name = "나", verified = true))
    private val me = 1L
    private val other = 2L

    private fun save(
        userId: Long,
        id: String = "noti-${UUID.randomUUID()}",
        read: Boolean = false,
        seq: Long = System.nanoTime(),
        type: String = NotificationType.POST_COMMENT_CREATED,
        href: String = "/posts/p1",
    ): String {
        repo.saveAndFlush(
            Notification(
                id = id,
                userId = userId,
                type = type,
                title = "제목",
                body = "본문",
                href = href,
                readAt = if (read) Instant.now() else null,
                createdAt = Instant.now(),
                time = "방금 전",
                seq = seq,
            ),
        )
        return id
    }

    private fun list(unreadOnly: Boolean? = null, page: Int? = null, size: Int? = null, bearer: String? = meToken) =
        mvc.get("/api/notifications") {
            if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
            if (unreadOnly != null) param("unreadOnly", unreadOnly.toString())
            if (page != null) param("page", page.toString())
            if (size != null) param("size", size.toString())
        }

    @Test
    fun `비로그인 목록과 unread-count는 401`() {
        list(bearer = null).andExpect { status { isUnauthorized() } }
        mvc.get("/api/notifications/unread-count").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `자신의 알림만 조회되고 다른 사용자 알림은 노출되지 않는다`() {
        val mine = save(me, id = "noti-mine")
        save(other, id = "noti-other")

        list().andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(1) }
            jsonPath("$.content[0].id") { value(mine) }
            jsonPath("$.content[0].userId") { doesNotExist() }
        }
    }

    @Test
    fun `알림 목록은 댓글 query string이 포함된 href를 보존한다`() {
        val href = "/posts/p1?commentId=pc-123"
        save(me, id = "noti-deeplink", href = href)

        list().andExpect {
            status { isOk() }
            jsonPath("$.content[0].href") { value(href) }
        }
    }

    @Test
    fun `정렬은 seq DESC id ASC`() {
        save(me, id = "noti-b", seq = 100)
        save(me, id = "noti-a", seq = 100)
        save(me, id = "noti-new", seq = 200)

        list().andExpect {
            status { isOk() }
            jsonPath("$.content[*].id") { value(Matchers.contains("noti-new", "noti-a", "noti-b")) }
        }
    }

    @Test
    fun `unreadOnly 필터와 unreadCount`() {
        save(me, id = "noti-unread", read = false)
        save(me, id = "noti-read", read = true)

        list().andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(2) }
            jsonPath("$.unreadCount") { value(1) }
        }
        list(unreadOnly = true).andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(1) }
            jsonPath("$.content[0].id") { value("noti-unread") }
            jsonPath("$.unreadCount") { value(1) }
        }
    }

    @Test
    fun `page와 size를 적용하고 범위를 검증한다`() {
        repeat(3) { save(me, seq = it.toLong()) }

        list(page = 1, size = 2).andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(1) }
            jsonPath("$.page") { value(1) }
            jsonPath("$.size") { value(2) }
            jsonPath("$.totalElements") { value(3) }
            jsonPath("$.totalPages") { value(2) }
        }
        list(page = -1).andExpect { status { isBadRequest() } }
        list(size = 0).andExpect { status { isBadRequest() } }
        list(size = 101).andExpect { status { isBadRequest() } }
        list(size = 1).andExpect { status { isOk() } }
        list(size = 100).andExpect { status { isOk() } }
    }

    @Test
    fun `unread-count는 자신의 안 읽음 개수만 센다`() {
        save(me, read = false)
        save(me, read = false)
        save(me, read = true)
        save(other, read = false)

        mvc.get("/api/notifications/unread-count") {
            headers { add("Authorization", "Bearer $meToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.unreadCount") { value(2) }
        }
    }

    @Test
    fun `내 알림 읽음 처리는 200이고 멱등하다`() {
        val id = save(me, read = false)

        mvc.post("/api/notifications/$id/read") {
            headers { add("Authorization", "Bearer $meToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.id") { value(id) }
            jsonPath("$.read") { value(true) }
            jsonPath("$.readAt") { exists() }
        }
        // 이미 읽은 알림을 다시 읽어도 200.
        mvc.post("/api/notifications/$id/read") {
            headers { add("Authorization", "Bearer $meToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.read") { value(true) }
        }
        assertThat(repo.countByUserIdAndReadAtIsNull(me)).isZero()
    }

    @Test
    fun `다른 사용자 알림과 없는 알림 읽음 처리는 404`() {
        val othersId = save(other)

        mvc.post("/api/notifications/$othersId/read") {
            headers { add("Authorization", "Bearer $meToken") }
        }.andExpect { status { isNotFound() } }
        mvc.post("/api/notifications/noti-missing/read") {
            headers { add("Authorization", "Bearer $meToken") }
        }.andExpect { status { isNotFound() } }
        // 남의 알림은 여전히 unread.
        assertThat(repo.findById(othersId).orElseThrow().readAt).isNull()
    }

    @Test
    fun `비로그인 읽음 처리는 401`() {
        val id = save(me)
        mvc.post("/api/notifications/$id/read").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `모두 읽음은 내 unread만 처리하고 멱등하다`() {
        save(me, read = false)
        save(me, read = false)
        save(me, read = true)
        val othersUnread = save(other, read = false)

        mvc.post("/api/notifications/read-all") {
            headers { add("Authorization", "Bearer $meToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.updatedCount") { value(2) }
            jsonPath("$.unreadCount") { value(0) }
        }
        // 다시 호출하면 처리할 게 없어 0.
        mvc.post("/api/notifications/read-all") {
            headers { add("Authorization", "Bearer $meToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.updatedCount") { value(0) }
            jsonPath("$.unreadCount") { value(0) }
        }
        // 남의 알림은 건드리지 않는다.
        assertThat(repo.findById(othersUnread).orElseThrow().readAt).isNull()
    }

    @Test
    fun `비로그인 알림 삭제는 401`() {
        val id = save(me)

        mvc.delete("/api/notifications/$id").andExpect { status { isUnauthorized() } }
        mvc.delete("/api/notifications/read").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `내 unread 알림 삭제는 목록과 unread count에서 제외한다`() {
        val id = save(me, read = false)

        mvc.delete("/api/notifications/$id") {
            headers { add("Authorization", "Bearer $meToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.deleted") { value(true) }
            jsonPath("$.unreadCount") { value(0) }
        }

        assertThat(repo.existsById(id)).isFalse()
        list().andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(0) }
            jsonPath("$.unreadCount") { value(0) }
        }
        mvc.get("/api/notifications/unread-count") {
            headers { add("Authorization", "Bearer $meToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.unreadCount") { value(0) }
        }
    }

    @Test
    fun `read 알림 삭제는 기존 unread count를 유지한다`() {
        val readId = save(me, read = true)
        val unreadId = save(me, read = false)

        mvc.delete("/api/notifications/$readId") {
            headers { add("Authorization", "Bearer $meToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.deleted") { value(true) }
            jsonPath("$.unreadCount") { value(1) }
        }

        assertThat(repo.existsById(readId)).isFalse()
        assertThat(repo.existsById(unreadId)).isTrue()
    }

    @Test
    fun `없는 알림과 다른 사용자 알림 삭제는 404이고 데이터를 유지한다`() {
        val othersId = save(other, read = false)

        mvc.delete("/api/notifications/noti-missing") {
            headers { add("Authorization", "Bearer $meToken") }
        }.andExpect { status { isNotFound() } }
        mvc.delete("/api/notifications/$othersId") {
            headers { add("Authorization", "Bearer $meToken") }
        }.andExpect { status { isNotFound() } }

        assertThat(repo.existsById(othersId)).isTrue()
    }

    @Test
    fun `읽은 알림 정리는 내 read만 삭제하고 unread와 다른 사용자 알림을 유지하며 멱등하다`() {
        save(me, read = true)
        save(me, read = true)
        val myUnread = save(me, read = false)
        val othersRead = save(other, read = true)

        mvc.delete("/api/notifications/read") {
            headers { add("Authorization", "Bearer $meToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.deletedCount") { value(2) }
            jsonPath("$.unreadCount") { value(1) }
        }
        mvc.delete("/api/notifications/read") {
            headers { add("Authorization", "Bearer $meToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.deletedCount") { value(0) }
            jsonPath("$.unreadCount") { value(1) }
        }

        assertThat(repo.existsById(myUnread)).isTrue()
        assertThat(repo.existsById(othersRead)).isTrue()
    }
}

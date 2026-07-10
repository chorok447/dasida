package com.dasida.api.message

import com.dasida.api.auth.UserBlockRepository
import com.dasida.api.auth.UserRepository
import com.dasida.api.notification.NotificationRepository
import com.dasida.api.notification.NotificationType
import com.dasida.api.security.JwtService
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.json.JsonMapper
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MessageControllerTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val mapper: JsonMapper,
    @param:Autowired val jwt: JwtService,
    @param:Autowired val users: UserRepository,
    @param:Autowired val conversations: ConversationRepository,
    @param:Autowired val blocks: UserBlockRepository,
    @param:Autowired val notifications: NotificationRepository,
) {
    @Test
    fun `대화 생성·메시지 전송·읽음·차단을 처리한다`() {
        val alice = users.save(
            com.dasida.api.auth.User(email = "a-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "앨리스"),
        )
        val bob = users.save(
            com.dasida.api.auth.User(email = "b-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "밥"),
        )
        val aliceId = requireNotNull(alice.id)
        val bobId = requireNotNull(bob.id)
        val aliceToken = jwt.issue(alice)
        val bobToken = jwt.issue(bob)

        val createBody = mapper.writeValueAsString(mapOf("peerUserId" to bobId))
        val createdJson = mvc.post("/api/messages/conversations") {
            header("Authorization", "Bearer $aliceToken")
            contentType = MediaType.APPLICATION_JSON
            content = createBody
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.peer.name", Matchers.`is`("밥")) }
            .andReturn().response.contentAsString

        val conversationId = mapper.readTree(createdJson).get("id").asString()

        mvc.post("/api/messages/conversations") {
            header("Authorization", "Bearer $aliceToken")
            contentType = MediaType.APPLICATION_JSON
            content = createBody
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.id", Matchers.`is`(conversationId)) }

        val sendBody = mapper.writeValueAsString(mapOf("content" to "안녕하세요"))
        mvc.post("/api/messages/conversations/$conversationId/messages") {
            header("Authorization", "Bearer $aliceToken")
            contentType = MediaType.APPLICATION_JSON
            content = sendBody
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.content", Matchers.`is`("안녕하세요")) }
            .andExpect { jsonPath("$.mine", Matchers.`is`(true)) }

        mvc.get("/api/messages/conversations/unread-count") {
            header("Authorization", "Bearer $bobToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.unreadCount", Matchers.`is`(1)) }

        mvc.post("/api/messages/conversations/$conversationId/read") {
            header("Authorization", "Bearer $bobToken")
        }.andExpect { status { isOk() } }

        mvc.get("/api/messages/conversations/unread-count") {
            header("Authorization", "Bearer $bobToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.unreadCount", Matchers.`is`(0)) }

        val notis = notifications.findByUserId(bobId, org.springframework.data.domain.PageRequest.of(0, 10))
        assert(notis.content.any { it.type == NotificationType.MESSAGE_RECEIVED })

        mvc.post("/api/users/$bobId/block") {
            header("Authorization", "Bearer $aliceToken")
        }.andExpect { status { isNoContent() } }

        mvc.post("/api/messages/conversations/$conversationId/messages") {
            header("Authorization", "Bearer $aliceToken")
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(mapOf("content" to "차단 후"))
        }.andExpect { status { isForbidden() } }

        mvc.get("/api/messages/conversations/$conversationId/messages") {
            header("Authorization", "Bearer $aliceToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.content.length()", Matchers.`is`(1)) }

        assert(blocks.existsByBlockerIdAndBlockedId(aliceId, bobId))
        assert(conversations.findById(conversationId).isPresent)
    }

    @Test
    fun `미읽음 총계는 여러 대화방을 합산하고 내 메시지와 읽은 대화방은 제외한다`() {
        val bob = users.save(
            com.dasida.api.auth.User(email = "b-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "밥"),
        )
        val alice = users.save(
            com.dasida.api.auth.User(email = "a-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "앨리스"),
        )
        val carol = users.save(
            com.dasida.api.auth.User(email = "c-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "캐럴"),
        )
        val bobToken = jwt.issue(bob)
        val aliceToken = jwt.issue(alice)
        val carolToken = jwt.issue(carol)

        fun openConversation(token: String, peerId: Long): String {
            val json = mvc.post("/api/messages/conversations") {
                header("Authorization", "Bearer $token")
                contentType = MediaType.APPLICATION_JSON
                content = mapper.writeValueAsString(mapOf("peerUserId" to peerId))
            }.andReturn().response.contentAsString
            return mapper.readTree(json).get("id").asString()
        }

        fun send(token: String, conversationId: String, text: String) {
            mvc.post("/api/messages/conversations/$conversationId/messages") {
                header("Authorization", "Bearer $token")
                contentType = MediaType.APPLICATION_JSON
                content = mapper.writeValueAsString(mapOf("content" to text))
            }.andExpect { status { isOk() } }
        }

        val convWithAlice = openConversation(aliceToken, requireNotNull(bob.id))
        val convWithCarol = openConversation(carolToken, requireNotNull(bob.id))
        send(aliceToken, convWithAlice, "하나")
        send(aliceToken, convWithAlice, "둘")
        send(carolToken, convWithCarol, "셋")
        send(carolToken, convWithCarol, "넷")
        send(carolToken, convWithCarol, "다섯")
        send(bobToken, convWithAlice, "내 답장은 안 센다")

        mvc.get("/api/messages/conversations/unread-count") {
            header("Authorization", "Bearer $bobToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.unreadCount", Matchers.`is`(5)) }

        mvc.post("/api/messages/conversations/$convWithCarol/read") {
            header("Authorization", "Bearer $bobToken")
        }.andExpect { status { isOk() } }

        mvc.get("/api/messages/conversations/unread-count") {
            header("Authorization", "Bearer $bobToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.unreadCount", Matchers.`is`(2)) }

        // 대화방 목록(bulk 경로): 최근 갱신 순서, peer 이름, 마지막 메시지, 대화방별 미읽음이 맞아야 한다.
        mvc.get("/api/messages/conversations?page=0&size=10") {
            header("Authorization", "Bearer $bobToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.content.length()", Matchers.`is`(2)) }
            .andExpect { jsonPath("$.content[0].peer.name", Matchers.`is`("앨리스")) }
            .andExpect { jsonPath("$.content[0].lastMessage.content", Matchers.`is`("내 답장은 안 센다")) }
            .andExpect { jsonPath("$.content[0].unreadCount", Matchers.`is`(2)) }
            .andExpect { jsonPath("$.content[1].peer.name", Matchers.`is`("캐럴")) }
            .andExpect { jsonPath("$.content[1].lastMessage.content", Matchers.`is`("다섯")) }
            .andExpect { jsonPath("$.content[1].unreadCount", Matchers.`is`(0)) }
    }

    @Test
    fun `본인 메시지만 삭제할 수 있고 삭제 후 본문이 마스킹된다`() {
        val alice = users.save(
            com.dasida.api.auth.User(email = "a-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "앨리스"),
        )
        val bob = users.save(
            com.dasida.api.auth.User(email = "b-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "밥"),
        )
        val aliceToken = jwt.issue(alice)
        val bobToken = jwt.issue(bob)

        val createdJson = mvc.post("/api/messages/conversations") {
            header("Authorization", "Bearer $aliceToken")
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(mapOf("peerUserId" to requireNotNull(bob.id)))
        }.andReturn().response.contentAsString
        val conversationId = mapper.readTree(createdJson).get("id").asString()

        val sentJson = mvc.post("/api/messages/conversations/$conversationId/messages") {
            header("Authorization", "Bearer $aliceToken")
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(mapOf("content" to "지울 메시지"))
        }.andReturn().response.contentAsString
        val messageId = mapper.readTree(sentJson).get("id").asString()

        // 상대(밥)는 삭제 불가
        mvc.delete("/api/messages/conversations/$conversationId/messages/$messageId") {
            header("Authorization", "Bearer $bobToken")
        }.andExpect { status { isForbidden() } }

        // 본인(앨리스) 삭제 → 204
        mvc.delete("/api/messages/conversations/$conversationId/messages/$messageId") {
            header("Authorization", "Bearer $aliceToken")
        }.andExpect { status { isNoContent() } }

        // 재삭제는 404
        mvc.delete("/api/messages/conversations/$conversationId/messages/$messageId") {
            header("Authorization", "Bearer $aliceToken")
        }.andExpect { status { isNotFound() } }

        // 목록에서 본문 마스킹 + deleted 플래그
        mvc.get("/api/messages/conversations/$conversationId/messages") {
            header("Authorization", "Bearer $bobToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.content[0].deleted", Matchers.`is`(true)) }
            .andExpect { jsonPath("$.content[0].content", Matchers.`is`("")) }

        // 대화 요약 미리보기도 마스킹
        mvc.get("/api/messages/conversations/$conversationId") {
            header("Authorization", "Bearer $bobToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.lastMessage.deleted", Matchers.`is`(true)) }
            .andExpect { jsonPath("$.lastMessage.content", Matchers.`is`("")) }
    }

    @Test
    fun `대화방을 나가면 목록·미읽음에서 제외되고 상대가 메시지를 보내면 복원된다`() {
        val alice = users.save(
            com.dasida.api.auth.User(email = "a-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "앨리스"),
        )
        val bob = users.save(
            com.dasida.api.auth.User(email = "b-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "밥"),
        )
        val aliceToken = jwt.issue(alice)
        val bobToken = jwt.issue(bob)

        val createdJson = mvc.post("/api/messages/conversations") {
            header("Authorization", "Bearer $aliceToken")
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(mapOf("peerUserId" to requireNotNull(bob.id)))
        }.andReturn().response.contentAsString
        val conversationId = mapper.readTree(createdJson).get("id").asString()

        mvc.post("/api/messages/conversations/$conversationId/messages") {
            header("Authorization", "Bearer $aliceToken")
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(mapOf("content" to "나가기 전 메시지"))
        }.andExpect { status { isOk() } }

        // 밥이 나감 → 목록 제외·미읽음 0·방 접근 403
        mvc.delete("/api/messages/conversations/$conversationId") {
            header("Authorization", "Bearer $bobToken")
        }.andExpect { status { isNoContent() } }
        mvc.get("/api/messages/conversations?page=0&size=10") {
            header("Authorization", "Bearer $bobToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.content.length()", Matchers.`is`(0)) }
        mvc.get("/api/messages/conversations/unread-count") {
            header("Authorization", "Bearer $bobToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.unreadCount", Matchers.`is`(0)) }
        mvc.get("/api/messages/conversations/$conversationId/messages") {
            header("Authorization", "Bearer $bobToken")
        }.andExpect { status { isForbidden() } }
        // 나간 방 재나가기도 403 (멤버십 없음)
        mvc.delete("/api/messages/conversations/$conversationId") {
            header("Authorization", "Bearer $bobToken")
        }.andExpect { status { isForbidden() } }

        // 앨리스가 새 메시지 → 밥 멤버십 복원(목록 재등장, 미읽음은 전체 2건)
        mvc.post("/api/messages/conversations/$conversationId/messages") {
            header("Authorization", "Bearer $aliceToken")
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(mapOf("content" to "복원 메시지"))
        }.andExpect { status { isOk() } }
        mvc.get("/api/messages/conversations?page=0&size=10") {
            header("Authorization", "Bearer $bobToken")
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.content.length()", Matchers.`is`(1)) }
            .andExpect { jsonPath("$.content[0].unreadCount", Matchers.`is`(2)) }

        // 내가 다시 DM 을 시작해도 복원된다 (밥이 다시 나간 뒤 재시작)
        mvc.delete("/api/messages/conversations/$conversationId") {
            header("Authorization", "Bearer $bobToken")
        }.andExpect { status { isNoContent() } }
        mvc.post("/api/messages/conversations") {
            header("Authorization", "Bearer $bobToken")
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(mapOf("peerUserId" to requireNotNull(alice.id)))
        }
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.id", Matchers.`is`(conversationId)) }
        mvc.get("/api/messages/conversations/$conversationId/messages") {
            header("Authorization", "Bearer $bobToken")
        }.andExpect { status { isOk() } }
    }

    @Test
    fun `DM 알림을 꺼둔 수신자에게는 MESSAGE_RECEIVED 알림을 만들지 않는다`() {
        val alice = users.save(
            com.dasida.api.auth.User(email = "a-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "앨리스"),
        )
        val bob = users.save(
            com.dasida.api.auth.User(email = "b-${UUID.randomUUID()}@t.com", passwordHash = "x", name = "밥", notifyMessages = false),
        )
        val bobId = requireNotNull(bob.id)
        val aliceToken = jwt.issue(alice)

        val createdJson = mvc.post("/api/messages/conversations") {
            header("Authorization", "Bearer $aliceToken")
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(mapOf("peerUserId" to bobId))
        }.andReturn().response.contentAsString
        val conversationId = mapper.readTree(createdJson).get("id").asString()

        mvc.post("/api/messages/conversations/$conversationId/messages") {
            header("Authorization", "Bearer $aliceToken")
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(mapOf("content" to "알림 없이 도착"))
        }.andExpect { status { isOk() } }

        // 알림 row 는 없지만 메시지 자체(미읽음)는 정상 적재된다.
        val notis = notifications.findByUserId(bobId, org.springframework.data.domain.PageRequest.of(0, 10))
        assert(notis.content.none { it.type == NotificationType.MESSAGE_RECEIVED })
    }
}

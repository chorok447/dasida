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
}

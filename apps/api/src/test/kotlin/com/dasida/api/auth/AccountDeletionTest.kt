package com.dasida.api.auth

import com.dasida.api.campaign.Campaign
import com.dasida.api.campaign.CampaignBody
import com.dasida.api.campaign.CampaignComment
import com.dasida.api.campaign.CampaignCommentRepository
import com.dasida.api.campaign.CampaignParticipant
import com.dasida.api.campaign.CampaignParticipantRepository
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.notification.Notification
import com.dasida.api.notification.NotificationRepository
import com.dasida.api.notification.NotificationType
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostBookmark
import com.dasida.api.post.PostBookmarkRepository
import com.dasida.api.post.PostComment
import com.dasida.api.post.PostCommentRepository
import com.dasida.api.post.PostLike
import com.dasida.api.post.PostLikeRepository
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.security.crypto.password.PasswordEncoder
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
class AccountDeletionTest(
    @Autowired private val mvc: MockMvc,
    @Autowired private val mapper: ObjectMapper,
    @Autowired private val users: UserRepository,
    @Autowired private val encoder: PasswordEncoder,
    @Autowired private val jwt: JwtService,
    @Autowired private val posts: PostRepository,
    @Autowired private val postComments: PostCommentRepository,
    @Autowired private val likes: PostLikeRepository,
    @Autowired private val bookmarks: PostBookmarkRepository,
    @Autowired private val campaigns: CampaignRepository,
    @Autowired private val campaignComments: CampaignCommentRepository,
    @Autowired private val participants: CampaignParticipantRepository,
    @Autowired private val notifications: NotificationRepository,
) {
    private fun saveUser(
        email: String,
        password: String = "Current1!",
        deletedAt: Instant? = null,
    ): User = users.saveAndFlush(
        User(
            email = email,
            passwordHash = encoder.encode(password),
            name = "탈퇴 전 사용자",
            verified = true,
            deletedAt = deletedAt,
        ),
    )

    private fun token(user: User) = jwt.issue(user)

    private fun deleteAccount(
        user: User,
        currentPassword: String,
        confirmText: String,
        authenticated: Boolean = true,
    ) = mvc.delete("/api/auth/me") {
        if (authenticated) headers { add("Authorization", "Bearer ${token(user)}") }
        contentType = MediaType.APPLICATION_JSON
        content = mapper.writeValueAsString(DeleteAccountRequest(currentPassword, confirmText))
    }

    private fun login(email: String, password: String) = mvc.post("/api/auth/login") {
        contentType = MediaType.APPLICATION_JSON
        content = mapper.writeValueAsString(LoginRequest(email, password))
    }

    @Test
    fun `비로그인 계정 탈퇴는 401`() {
        val user = saveUser("delete-unauthorized@dasida.com")

        deleteAccount(user, "Current1!", "탈퇴합니다", authenticated = false)
            .andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `탈퇴 요청은 비밀번호와 확인 문구를 검증하고 실패하면 계정을 유지한다`() {
        val email = "delete-validation@dasida.com"
        val user = saveUser(email)
        val originalHash = user.passwordHash
        val invalidRequests = listOf(
            "" to "탈퇴합니다",
            "Current1!" to "",
            "Current1!" to "탈퇴할게요",
            "Wrong1!x" to "탈퇴합니다",
        )

        invalidRequests.forEach { (password, confirmation) ->
            deleteAccount(user, password, confirmation)
                .andExpect { status { isBadRequest() } }
        }

        val active = users.findById(requireNotNull(user.id)).orElseThrow()
        assertThat(active.deletedAt).isNull()
        assertThat(active.email).isEqualTo(email)
        assertThat(active.passwordHash).isEqualTo(originalHash)
        login(email, "Current1!").andExpect { status { isOk() } }
    }

    @Test
    fun `탈퇴하면 계정과 작성자만 익명화하고 관련 데이터와 딥링크를 유지한다`() {
        val originalEmail = "delete-success@dasida.com"
        val user = saveUser(originalEmail)
        val userId = requireNotNull(user.id)
        val oldHash = user.passwordHash
        val oldToken = token(user)
        val suffix = UUID.randomUUID().toString()

        val postId = "delete-post-$suffix"
        posts.saveAndFlush(
            Post(
                id = postId,
                author = Author("탈퇴 전 사용자", true),
                time = "방금",
                text = "탈퇴 후에도 유지되는 게시글 $suffix",
                tags = emptyList(),
                images = emptyList(),
                likes = 2,
                comments = 1,
                seq = 10,
                authorUserId = userId,
            ),
        )
        val legacyPostId = "delete-legacy-post-$suffix"
        posts.saveAndFlush(
            Post(
                legacyPostId, Author("동명이인", false), "방금", "legacy", emptyList(), emptyList(), 0, 0,
                authorUserId = null,
            ),
        )
        val postCommentId = "delete-post-comment-$suffix"
        postComments.saveAndFlush(
            PostComment(
                postCommentId, postId, Author("탈퇴 전 사용자", true), "게시글 댓글 유지", "방금",
                seq = 20, authorUserId = userId,
            ),
        )
        likes.saveAndFlush(PostLike("delete-like-me-$suffix", postId, userId))
        likes.saveAndFlush(PostLike("delete-like-other-$suffix", postId, 2L))
        bookmarks.saveAndFlush(PostBookmark("delete-bookmark-me-$suffix", postId, userId))
        bookmarks.saveAndFlush(PostBookmark("delete-bookmark-other-$suffix", postId, 2L))

        val campaignId = "delete-campaign-$suffix"
        campaigns.saveAndFlush(
            Campaign(
                id = campaignId,
                status = "open",
                title = "탈퇴 후에도 유지되는 캠페인 $suffix",
                summary = "요약",
                thumb = "https://example.com/thumb.png",
                recruitStart = "2026-06-01",
                recruitEnd = "2026-07-31",
                runStart = "2026-08-01",
                runEnd = "2026-08-31",
                capacity = 10,
                joined = 2,
                daysLeftLabel = "모집 중",
                author = Author("탈퇴 전 사용자", true),
                body = CampaignBody("소개", listOf("본문 유지"), emptyList()),
                seq = 10,
                authorUserId = userId,
            ),
        )
        val campaignCommentId = "delete-campaign-comment-$suffix"
        campaignComments.saveAndFlush(
            CampaignComment(
                campaignCommentId, campaignId, Author("탈퇴 전 사용자", true), "캠페인 댓글 유지",
                Instant.parse("2026-06-30T00:00:00Z"), authorUserId = userId,
            ),
        )
        participants.saveAndFlush(CampaignParticipant("delete-participant-me-$suffix", campaignId, userId))
        participants.saveAndFlush(CampaignParticipant("delete-participant-other-$suffix", campaignId, 2L))
        val notificationId = "delete-notification-$suffix"
        notifications.saveAndFlush(
            Notification(
                id = notificationId,
                userId = userId,
                type = NotificationType.POST_COMMENT_CREATED,
                title = "알림 유지",
                body = "본문",
                href = "/posts/$postId?commentId=$postCommentId",
                readAt = null,
                createdAt = Instant.parse("2026-06-30T00:00:00Z"),
                time = "방금",
                seq = 1,
            ),
        )

        deleteAccount(user, "Current1!", "탈퇴합니다").andExpect {
            status { isOk() }
            jsonPath("$.deleted") { value(true) }
            jsonPath("$.token") { doesNotExist() }
            jsonPath("$.passwordHash") { doesNotExist() }
            jsonPath("$.currentPassword") { doesNotExist() }
        }

        val deleted = users.findById(userId).orElseThrow()
        assertThat(deleted.deletedAt).isNotNull()
        assertThat(deleted.email).isNotEqualTo(originalEmail).endsWith("@deleted.local")
        assertThat(deleted.name).isEqualTo("탈퇴한 사용자")
        assertThat(deleted.passwordHash).isNotEqualTo(oldHash).doesNotContain("Current1!")
        assertThat(encoder.matches("Current1!", deleted.passwordHash)).isFalse()

        assertThat(posts.findById(postId).orElseThrow().author.name).isEqualTo("탈퇴한 사용자")
        assertThat(posts.findById(postId).orElseThrow().author.verified).isFalse()
        assertThat(posts.findById(postId).orElseThrow().text).contains("유지되는 게시글")
        assertThat(posts.findById(legacyPostId).orElseThrow().author.name).isEqualTo("동명이인")
        assertThat(postComments.findById(postCommentId).orElseThrow().author.name).isEqualTo("탈퇴한 사용자")
        assertThat(postComments.findById(postCommentId).orElseThrow().author.verified).isFalse()
        assertThat(postComments.findById(postCommentId).orElseThrow().text).isEqualTo("게시글 댓글 유지")
        assertThat(campaigns.findById(campaignId).orElseThrow().author.name).isEqualTo("탈퇴한 사용자")
        assertThat(campaigns.findById(campaignId).orElseThrow().author.verified).isFalse()
        assertThat(campaigns.findById(campaignId).orElseThrow().body.paragraphs).containsExactly("본문 유지")
        assertThat(campaignComments.findById(campaignCommentId).orElseThrow().author.name).isEqualTo("탈퇴한 사용자")
        assertThat(campaignComments.findById(campaignCommentId).orElseThrow().author.verified).isFalse()
        assertThat(campaignComments.findById(campaignCommentId).orElseThrow().text).isEqualTo("캠페인 댓글 유지")
        assertThat(likes.countByPostId(postId)).isEqualTo(2)
        assertThat(bookmarks.countByPostId(postId)).isEqualTo(2)
        assertThat(participants.countByCampaignId(campaignId)).isEqualTo(2)
        assertThat(notifications.existsById(notificationId)).isTrue()

        mvc.get("/api/auth/me") { headers { add("Authorization", "Bearer $oldToken") } }
            .andExpect { status { isUnauthorized() } }
        mvc.post("/api/posts") {
            headers { add("Authorization", "Bearer $oldToken") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"사용 불가"}"""
        }.andExpect { status { isUnauthorized() } }
        mvc.get("/api/posts/$postId") { headers { add("Authorization", "Bearer $oldToken") } }
            .andExpect { status { isUnauthorized() } }
        login(originalEmail, "Current1!").andExpect { status { isUnauthorized() } }

        mvc.get("/api/posts/$postId").andExpect {
            status { isOk() }
            jsonPath("$.author.name") { value("탈퇴한 사용자") }
        }
        mvc.get("/api/posts/$postId/comments/page").andExpect {
            status { isOk() }
            jsonPath("$.content[0].author.name") { value("탈퇴한 사용자") }
            jsonPath("$.content[0].ownedByMe") { value(false) }
        }
        mvc.get("/api/posts/$postId/comments/$postCommentId/page").andExpect { status { isOk() } }
        mvc.get("/api/campaigns/$campaignId").andExpect {
            status { isOk() }
            jsonPath("$.author.name") { value("탈퇴한 사용자") }
        }
        mvc.get("/api/campaigns/$campaignId/comments").andExpect {
            status { isOk() }
            jsonPath("$.content[0].author.name") { value("탈퇴한 사용자") }
            jsonPath("$.content[0].ownedByMe") { value(false) }
        }
        mvc.get("/api/campaigns/$campaignId/comments/$campaignCommentId/page")
            .andExpect { status { isOk() } }
        mvc.get("/api/posts/search") { param("q", suffix) }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].author.name") { value("탈퇴한 사용자") }
        }
        mvc.get("/api/campaigns/search") { param("q", suffix) }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].author.name") { value("탈퇴한 사용자") }
        }

        val signup = mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(SignupRequest(originalEmail, "NewPassword2@", "새 사용자"))
        }.andExpect { status { isCreated() } }.andReturn().response
        val newToken = mapper.readTree(signup.contentAsString).get("token").asText()
        val newUser = users.findByEmail(originalEmail) ?: error("re-created user missing")
        assertThat(newUser.id).isNotEqualTo(userId)

        mvc.get("/api/posts/$postId") { headers { add("Authorization", "Bearer $newToken") } }.andExpect {
            status { isOk() }
            jsonPath("$.ownedByMe") { value(false) }
        }
        mvc.get("/api/campaigns/$campaignId") { headers { add("Authorization", "Bearer $newToken") } }.andExpect {
            status { isOk() }
            jsonPath("$.ownedByMe") { value(false) }
        }
    }

    @Test
    fun `deletedAt이 있는 사용자는 익명화 이메일을 알아도 로그인할 수 없다`() {
        val email = "already-deleted@deleted.local"
        saveUser(email, password = "Known1!x", deletedAt = Instant.parse("2026-06-30T00:00:00Z"))

        login(email, "Known1!x").andExpect { status { isUnauthorized() } }
    }
}

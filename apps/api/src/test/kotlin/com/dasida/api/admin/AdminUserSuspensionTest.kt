package com.dasida.api.admin

import com.dasida.api.auth.AuthService
import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import com.dasida.api.auth.UserRole
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import tools.jackson.databind.json.JsonMapper
import java.time.Instant
import java.util.UUID

/** 회원 정지(제재)의 관리자 API 와 인증 3경로(기존 토큰/로그인/refresh) 차단 검증. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminUserSuspensionTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val mapper: JsonMapper,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val users: UserRepository,
    @param:Autowired private val authService: AuthService,
) {
    private val adminToken = jwt.issue(
        User(id = 4, email = "test-user-4@dasida.local", passwordHash = "x", name = "관리자"),
    )
    private val userToken = jwt.issue(
        User(id = 2, email = "test-user-2@dasida.local", passwordHash = "x", name = "일반 사용자"),
    )

    @BeforeEach
    fun promoteAdmin() {
        val admin = users.findById(4).orElseThrow()
        admin.role = UserRole.ADMIN.name
        users.saveAndFlush(admin)
    }

    private fun setSuspension(userId: Long, until: String?, reason: String? = null, bearer: String? = adminToken) =
        mvc.patch("/api/admin/users/$userId/suspension") {
            if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(SetUserSuspensionRequest(until, reason))
        }

    private fun futureIso(days: Long = 7): String = Instant.now().plusSeconds(days * 24 * 3600).toString()

    /** 실제 비밀번호를 가진 계정이 필요할 때 signup 으로 생성한다. */
    private fun signupUser(): Pair<Long, String> {
        val email = "suspend-${UUID.randomUUID()}@test.com"
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"$email","password":"Password1!","name":"정지 대상"}"""
        }.andExpect { status { isCreated() } }
        return users.findByEmail(email)!!.id!! to email
    }

    @Test
    fun `회원 관리 API는 비로그인 401 일반 사용자 403`() {
        mvc.get("/api/admin/users").andExpect { status { isUnauthorized() } }
        mvc.get("/api/admin/users") {
            headers { add("Authorization", "Bearer $userToken") }
        }.andExpect { status { isForbidden() } }
        setSuspension(2, futureIso(), bearer = userToken).andExpect { status { isForbidden() } }
    }

    @Test
    fun `회원 목록은 검색과 정지 상태를 반환한다`() {
        setSuspension(2, futureIso(), reason = "반복 신고 누적").andExpect {
            status { isOk() }
            jsonPath("$.suspended") { value(true) }
            jsonPath("$.suspendedReason") { value("반복 신고 누적") }
        }

        // "test-user-2" 는 시드 사용자 201/211/212 에도 부분 일치하므로 "@" 까지 붙여 user 2 만 매칭한다.
        mvc.get("$USERS_PATH?q=test-user-2@") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(1) }
            jsonPath("$.content[0].id") { value(2) }
            jsonPath("$.content[0].suspended") { value(true) }
            jsonPath("$.content[0].role") { value("USER") }
        }
        mvc.get("$USERS_PATH?q=존재하지-않는-회원") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(0) }
        }
    }

    @Test
    fun `정지된 사용자는 기존 토큰이 즉시 차단된다`() {
        mvc.get("/api/auth/me") {
            headers { add("Authorization", "Bearer $userToken") }
        }.andExpect { status { isOk() } }

        setSuspension(2, futureIso()).andExpect { status { isOk() } }

        mvc.get("/api/auth/me") {
            headers { add("Authorization", "Bearer $userToken") }
        }.andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `정지된 사용자는 로그인이 403이고 해제하면 다시 로그인된다`() {
        val (userId, email) = signupUser()

        setSuspension(userId, futureIso()).andExpect { status { isOk() } }
        mvc.post("/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"$email","password":"Password1!"}"""
        }.andExpect {
            status { isForbidden() }
            jsonPath("$.detail") { value(org.hamcrest.Matchers.containsString("정지된 계정")) }
        }

        setSuspension(userId, null).andExpect {
            status { isOk() }
            jsonPath("$.suspended") { value(false) }
            jsonPath("$.suspendedUntil") { value(null) }
        }
        mvc.post("/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"$email","password":"Password1!"}"""
        }.andExpect { status { isOk() } }
    }

    @Test
    fun `정지된 사용자는 refresh 로 세션을 연장할 수 없다`() {
        val user = users.findById(2).orElseThrow()
        val refreshToken = jwt.issueRefresh(user)

        user.suspendedUntil = Instant.now().plusSeconds(3600)
        users.saveAndFlush(user)

        assertThatThrownBy { authService.refresh(refreshToken) }
            .isInstanceOfSatisfying(ResponseStatusException::class.java) {
                assertThat(it.statusCode).isEqualTo(HttpStatus.UNAUTHORIZED)
            }
    }

    @Test
    fun `관리자 계정과 탈퇴 없는 계정은 정지할 수 없다`() {
        // 관리자(user 4) → 400
        setSuspension(4, futureIso()).andExpect { status { isBadRequest() } }
        // 없는 계정 → 404
        setSuspension(999999, futureIso()).andExpect { status { isNotFound() } }
        // 탈퇴 계정 → 404
        val deleted = users.findById(9).orElseThrow()
        deleted.deletedAt = Instant.now()
        users.saveAndFlush(deleted)
        setSuspension(9, futureIso()).andExpect { status { isNotFound() } }
    }

    @Test
    fun `잘못된 정지 요청은 400이다`() {
        // 과거 시각
        setSuspension(2, Instant.now().minusSeconds(3600).toString()).andExpect { status { isBadRequest() } }
        // 형식 오류
        setSuspension(2, "not-a-date").andExpect { status { isBadRequest() } }
        // 사유 초과
        setSuspension(2, futureIso(), reason = "a".repeat(501)).andExpect { status { isBadRequest() } }
    }

    private companion object {
        const val USERS_PATH = "/api/admin/users"
    }
}

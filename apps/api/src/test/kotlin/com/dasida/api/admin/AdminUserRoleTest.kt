package com.dasida.api.admin

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import com.dasida.api.auth.UserRole
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** 회원 역할 변경(승격/강등) API 와 즉시 반영·감사 로그 검증. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminUserRoleTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val users: UserRepository,
    @param:Autowired private val actionLogs: AdminActionLogRepository,
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

    private fun setRole(userId: Long, role: String, bearer: String? = adminToken) =
        mvc.patch("/api/admin/users/$userId/role") {
            if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"role":"$role"}"""
        }

    @Test
    fun `역할 변경은 비로그인 401 일반 사용자 403`() {
        setRole(2, "ADMIN", bearer = null).andExpect { status { isUnauthorized() } }
        setRole(2, "ADMIN", bearer = userToken).andExpect { status { isForbidden() } }
    }

    @Test
    fun `승격하면 기존 토큰으로 즉시 관리자 API 를 쓸 수 있고 강등하면 즉시 차단된다`() {
        // 승격 전: user 2 는 관리자 API 403
        mvc.get("/api/admin/summary") {
            headers { add("Authorization", "Bearer $userToken") }
        }.andExpect { status { isForbidden() } }

        setRole(2, "ADMIN").andExpect {
            status { isOk() }
            jsonPath("$.role") { value("ADMIN") }
        }
        // JwtAuthFilter 가 매 요청 DB role 을 읽으므로 같은 토큰이 즉시 통과한다.
        mvc.get("/api/admin/summary") {
            headers { add("Authorization", "Bearer $userToken") }
        }.andExpect { status { isOk() } }

        setRole(2, "USER").andExpect {
            status { isOk() }
            jsonPath("$.role") { value("USER") }
        }
        mvc.get("/api/admin/summary") {
            headers { add("Authorization", "Bearer $userToken") }
        }.andExpect { status { isForbidden() } }

        assertThat(actionLogs.findAll().map { it.action to it.detail }).containsExactly(
            "ROLE_CHANGED" to "USER → ADMIN",
            "ROLE_CHANGED" to "ADMIN → USER",
        )
    }

    @Test
    fun `본인 역할 변경과 잘못된 요청은 거부되고 같은 역할 재요청은 무음이다`() {
        // 본인(관리자 4) 강등 시도 → 400 (마지막 관리자 잠금 사고 방지)
        setRole(4, "USER").andExpect { status { isBadRequest() } }
        // 잘못된 역할 값 → 400
        setRole(2, "SUPERUSER").andExpect { status { isBadRequest() } }
        // 없는 계정 → 404
        setRole(999999, "ADMIN").andExpect { status { isNotFound() } }
        // 같은 역할 재요청 → 200, 로그 없음
        setRole(2, "USER").andExpect { status { isOk() } }
        assertThat(actionLogs.count()).isZero()
    }

    @Test
    fun `신규 가입 회원은 가입 시각이 기록되어 관리자 목록에 노출된다`() {
        val email = "role-created-${UUID.randomUUID()}@test.com"
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"$email","password":"Password1!","name":"가입일 확인"}"""
        }.andExpect { status { isCreated() } }

        mvc.get("/api/admin/users?q=$email") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(1) }
            jsonPath("$.content[0].createdAt") { isNotEmpty() }
        }
        // 가입일 도입 이전 시드 계정(created_at 없음)은 null 로 정직하게 내려간다.
        mvc.get("/api/admin/users?q=test-user-2@") {
            headers { add("Authorization", "Bearer $adminToken") }
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].createdAt") { value(null) }
        }
    }
}

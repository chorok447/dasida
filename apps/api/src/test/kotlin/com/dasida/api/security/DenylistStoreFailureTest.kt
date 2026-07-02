package com.dasida.api.security

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional

/**
 * denylist store 장애(예: Redis 다운) 시 인증 정책 검증.
 * - Bearer 인증 요청: fail-closed → 401(무효화 여부를 확인 못 하면 거절)
 * - 토큰 없는 public 요청: 영향 없음(denylist 는 Bearer 있을 때만 조회)
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DenylistStoreFailureTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val repo: UserRepository,
    @param:Autowired val jwt: JwtService,
) {
    @TestConfiguration
    class ThrowingDenylistStoreConfig {
        @Bean
        @Primary
        fun throwingDenylistStore(): TokenDenylistStore = object : TokenDenylistStore {
            override fun deny(tokenHash: String, ttlSeconds: Long) = throw RuntimeException("store down")
            override fun isDenied(tokenHash: String): Boolean = throw RuntimeException("store down")
        }
    }

    @Test
    fun `denylist store 장애 시 Bearer 인증 API 는 fail-closed 로 401`() {
        val user = repo.saveAndFlush(User(email = "denylist-down@dasida.com", passwordHash = "h", name = "유저"))
        val token = jwt.issue(user)

        mvc.get("/api/auth/me") { headers { add("Authorization", "Bearer $token") } }
            .andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `denylist store 장애여도 토큰 없는 public GET 은 정상 동작한다`() {
        mvc.get("/api/posts").andExpect { status { isOk() } }
    }
}

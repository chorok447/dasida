package com.dasida.api.common

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import com.dasida.api.auth.UserRole
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.campaign.CampaignSeed
import com.dasida.api.post.PostRepository
import com.dasida.api.post.PostSeed
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.CommandLineRunner
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component

/**
 * 비어있는 테이블에만 시드 적재. reversed() 로 저장해 seq DESC 정렬 시 시드 원래 순서(p1, c1 …)가 유지된다.
 * 알림은 사용자별 도메인 이벤트로만 생성되므로 시드하지 않는다.
 */
@Component
class SeedRunner(
    private val posts: PostRepository,
    private val campaigns: CampaignRepository,
    private val users: UserRepository,
    private val encoder: PasswordEncoder,
    @Value("\${app.admin.email}") private val adminEmail: String,
    @Value("\${app.admin.password}") private val adminPassword: String,
    @Value("\${app.admin.name}") private val adminName: String,
) : CommandLineRunner {
    override fun run(vararg args: String) {
        if (posts.count() == 0L) {
            posts.saveAll(PostSeed.posts.reversed().onEachIndexed { i, p -> p.seq = (i + 1).toLong() })
        }
        if (campaigns.count() == 0L) {
            campaigns.saveAll(CampaignSeed.campaigns.reversed().onEachIndexed { i, c -> c.seq = (i + 1).toLong() })
        }
        seedAdmin()
    }

    /**
     * 부트스트랩 관리자 계정. ADMIN_PASSWORD 가 설정된 경우에만 생성한다
     * (기본 비밀번호를 내장하면 운영에서 그대로 노출될 수 있어 명시적 주입을 요구).
     * 이미 존재하는 계정이면 role 승격만 보장하고 비밀번호는 건드리지 않는다.
     */
    private fun seedAdmin() {
        val existing = users.findByEmail(adminEmail.trim().lowercase())
        if (existing != null) {
            if (!existing.isAdmin) {
                existing.role = UserRole.ADMIN.name
                users.save(existing)
                log.info("promoted existing user to ADMIN: {}", adminEmail)
            }
            return
        }
        if (adminPassword.isBlank()) {
            log.info("admin seed skipped: ADMIN_PASSWORD not set")
            return
        }
        users.save(
            User(
                email = adminEmail.trim().lowercase(),
                passwordHash = encoder.encode(adminPassword)!!,
                name = adminName,
                verified = true,
                role = UserRole.ADMIN.name,
            ),
        )
        log.info("admin account seeded: {}", adminEmail)
    }

    private companion object {
        private val log = LoggerFactory.getLogger(SeedRunner::class.java)
    }
}

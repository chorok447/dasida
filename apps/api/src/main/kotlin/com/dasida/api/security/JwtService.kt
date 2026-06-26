package com.dasida.api.security

import com.dasida.api.auth.User
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.util.Date

@Service
class JwtService(
    @Value("\${app.jwt.secret}") secret: String,
    @Value("\${app.jwt.ttl-millis}") private val ttlMillis: Long,
    @Value("\${spring.profiles.active:}") activeProfiles: String,
) {
    init {
        // prod 에서 dev 플레이스홀더 시크릿으로 기동 차단. JWT_SECRET 누락 시 토큰 위조 방지로 기동 실패.
        // ponytail: prod 배포가 SPRING_PROFILES_ACTIVE=prod 를 설정한다고 가정. 항상 강제하려면 기본값 제거 + 테스트 프로파일 추가.
        // comma-separated 프로파일을 정확히 파싱해 "prod" 정확 일치만 prod 로 판정(preprod/nonprod 오인 방지).
        val isProd = activeProfiles.split(",").map { it.trim() }.any { it == "prod" }
        require(!(isProd && secret.startsWith("dev-insecure"))) {
            "JWT_SECRET must be set in production (refusing to start with the insecure dev default)"
        }
    }

    private val key = Keys.hmacShaKeyFor(secret.toByteArray())

    fun issue(user: User): String =
        Jwts.builder()
            .subject(user.id.toString())
            .claim("name", user.name)
            .claim("verified", user.verified)
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + ttlMillis))
            .signWith(key)
            .compact()

    /** 유효하지 않으면 예외. 호출부에서 잡아 미인증 처리. */
    fun parse(token: String): AuthUser {
        val c = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).payload
        return AuthUser(c.subject.toLong(), c["name"] as String, c["verified"] as Boolean)
    }
}

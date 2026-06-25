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
) {
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

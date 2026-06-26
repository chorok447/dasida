package com.dasida.api.auth

import com.dasida.api.security.AuthUser
import com.dasida.api.security.JwtService
import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

@Entity
@Table(name = "users")
class User(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long? = null,
    @Column(unique = true) val email: String,
    @JsonIgnore val passwordHash: String,
    val name: String,
    val verified: Boolean = false,
)

interface UserRepository : JpaRepository<User, Long> {
    fun findByEmail(email: String): User?
    fun existsByEmail(email: String): Boolean
}

data class SignupRequest(val email: String, val password: String, val name: String)
data class LoginRequest(val email: String, val password: String)
data class AuthResponse(val token: String, val name: String, val verified: Boolean)

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val repo: UserRepository,
    private val encoder: PasswordEncoder,
    private val jwt: JwtService,
) {
    // 유저 없을 때 BCrypt 시간을 맞추기 위한 더미 해시(1회 계산). 타이밍 기반 가입여부 노출 방지용.
    private val dummyHash = encoder.encode("__no_such_user__")

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    fun signup(@RequestBody req: SignupRequest): AuthResponse {
        val email = req.email.trim().lowercase()
        val name = req.name.trim()
        if (email.isBlank() || name.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "email and name are required")
        }
        if (!email.matches(EMAIL_RE)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid email format")
        }
        if (!req.password.matches(PASSWORD_RE)) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "password must be 8-15 chars with letters, digits and a special character",
            )
        }
        // 빠른 실패용 사전 체크. 동시 가입 경쟁은 아래 unique 제약 위반 catch 로 처리.
        if (repo.existsByEmail(email)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "email already registered")
        }
        val user = try {
            repo.save(User(email = email, passwordHash = encoder.encode(req.password), name = name))
        } catch (e: DataIntegrityViolationException) {
            // 동시 요청이 사전 체크를 둘 다 통과한 경우 → unique 제약 위반을 409 로 변환(500 방지)
            throw ResponseStatusException(HttpStatus.CONFLICT, "email already registered")
        }
        return AuthResponse(jwt.issue(user), user.name, user.verified)
    }

    @PostMapping("/login")
    fun login(@RequestBody req: LoginRequest): AuthResponse {
        val user = repo.findByEmail(req.email.trim().lowercase())
        if (user == null) {
            // ponytail: 유저가 없어도 BCrypt 1회 실행 → 응답시간 차이로 가입 여부가 새는 것을 방지
            encoder.matches(req.password, dummyHash)
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials")
        }
        if (!encoder.matches(req.password, user.passwordHash)) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials")
        }
        return AuthResponse(jwt.issue(user), user.name, user.verified)
    }

    @GetMapping("/me")
    fun me(@AuthenticationPrincipal user: AuthUser?): AuthUser =
        user ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "not authenticated")

    companion object {
        // ponytail: 형식 sanity 체크만(RFC 5322 아님). local@domain.tld 수준이면 통과.
        private val EMAIL_RE = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")

        // 프론트 회원가입 정책과 일치: 영문/숫자/특수문자 각 1개 이상, 8~15자.
        private val PASSWORD_RE = Regex("^(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,15}$")
    }
}

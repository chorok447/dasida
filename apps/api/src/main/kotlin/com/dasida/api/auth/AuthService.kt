package com.dasida.api.auth

import com.dasida.api.campaign.CampaignCommentRepository
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.post.PostCommentRepository
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Clock
import java.time.Instant
import java.util.UUID

/**
 * 인증·계정 도메인 서비스. 회원가입/로그인/내 정보 조회/프로필 수정/비밀번호·이메일 변경/계정 탈퇴 정책을 담당한다.
 * Controller 에서 옮겨온 email/password/name validation, BCrypt 검증, JWT 발급, 탈퇴 익명화, 트랜잭션을 이 계층에 둔다.
 */
@Service
class AuthService(
    private val repo: UserRepository,
    private val encoder: PasswordEncoder,
    private val jwt: JwtService,
    private val posts: PostRepository,
    private val postComments: PostCommentRepository,
    private val campaigns: CampaignRepository,
    private val campaignComments: CampaignCommentRepository,
    private val clock: Clock,
) {
    // 유저 없을 때 BCrypt 시간을 맞추기 위한 더미 해시(1회 계산). 타이밍 기반 가입여부 노출 방지용.
    private val dummyHash = encoder.encode("__no_such_user__")

    @Transactional
    fun signup(req: SignupRequest): AuthResponse {
        val email = normalizeEmail(req.email)
        val name = normalizeName(req.name)
        validatePassword(req.password)
        // 빠른 실패용 사전 체크. 동시 가입 경쟁은 아래 unique 제약 위반 catch 로 처리.
        if (repo.existsByEmail(email)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "email already registered")
        }
        val user = try {
            // saveAndFlush 로 트랜잭션 안에서 INSERT 를 강제해, unique 제약 위반을 이 자리에서 catch → 409 로 변환한다.
            // [spike] Spring Security 7 에서 PasswordEncoder.encode 반환이 @Nullable(String?) 로 변경 → non-null 보장.
            repo.saveAndFlush(User(email = email, passwordHash = encoder.encode(req.password)!!, name = name))
        } catch (e: DataIntegrityViolationException) {
            // 동시 요청이 사전 체크를 둘 다 통과한 경우 → unique 제약 위반을 409 로 변환(500 방지)
            throw ResponseStatusException(HttpStatus.CONFLICT, "email already registered")
        }
        return user.toAuthResponse(jwt.issue(user))
    }

    @Transactional(readOnly = true)
    fun login(req: LoginRequest): AuthResponse {
        val user = repo.findByEmail(req.email.trim().lowercase())
        if (user == null || user.deletedAt != null) {
            // ponytail: 유저가 없어도 BCrypt 1회 실행 → 응답시간 차이로 가입 여부가 새는 것을 방지
            encoder.matches(req.password, user?.passwordHash ?: dummyHash)
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials")
        }
        if (!encoder.matches(req.password, user.passwordHash)) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials")
        }
        return user.toAuthResponse(jwt.issue(user))
    }

    @Transactional(readOnly = true)
    fun getMe(userId: Long): UserProfileResponse = activeUser(userId).toProfile()

    @Transactional
    fun updateProfile(userId: Long, req: UpdateProfileRequest): UpdateProfileResponse {
        val user = activeUser(userId)
        user.name = normalizeName(req.name)
        return UpdateProfileResponse(token = jwt.issue(user), profile = user.toProfile())
    }

    @Transactional
    fun changePassword(userId: Long, req: ChangePasswordRequest): ChangePasswordResponse {
        val user = activeUser(userId)
        if (req.currentPassword.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "current password is required")
        }
        if (!encoder.matches(req.currentPassword, user.passwordHash)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "current password is incorrect")
        }
        validatePassword(req.newPassword)
        if (encoder.matches(req.newPassword, user.passwordHash)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "new password must be different")
        }
        user.passwordHash = encoder.encode(req.newPassword)!!
        return ChangePasswordResponse(changed = true, token = jwt.issue(user))
    }

    @Transactional
    fun changeEmail(userId: Long, req: ChangeEmailRequest): ChangeEmailResponse {
        val user = activeUser(userId)
        if (req.currentPassword.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "current password is required")
        }
        if (!encoder.matches(req.currentPassword, user.passwordHash)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "current password is incorrect")
        }

        val email = normalizeEmail(req.newEmail)
        if (email == user.email) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "new email must be different")
        }
        if (repo.existsByEmail(email)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "email already registered")
        }

        user.email = email
        try {
            repo.saveAndFlush(user)
        } catch (_: DataIntegrityViolationException) {
            // 사전 중복 체크 뒤 발생한 동시 변경 경쟁도 DB unique 제약 기준으로 409 처리한다.
            throw ResponseStatusException(HttpStatus.CONFLICT, "email already registered")
        }
        return ChangeEmailResponse(email = user.email, name = user.name, token = jwt.issue(user))
    }

    @Transactional
    fun deleteAccount(userId: Long, req: DeleteAccountRequest): DeleteAccountResponse {
        val user = activeUser(userId)
        if (req.currentPassword.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "current password is required")
        }
        if (req.confirmText.isBlank() || req.confirmText != DELETE_CONFIRM_TEXT) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "delete confirmation is incorrect")
        }
        if (!encoder.matches(req.currentPassword, user.passwordHash)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "current password is incorrect")
        }

        val id = requireNotNull(user.id)
        user.email = "deleted-$id-${UUID.randomUUID()}@deleted.local"
        user.name = DELETED_USER_NAME
        user.passwordHash = encoder.encode(UUID.randomUUID().toString())!!
        user.deletedAt = Instant.now(clock)
        repo.saveAndFlush(user)

        posts.anonymizeAuthor(id, DELETED_USER_NAME)
        postComments.anonymizeAuthor(id, DELETED_USER_NAME)
        campaigns.anonymizeAuthor(id, DELETED_USER_NAME)
        campaignComments.anonymizeAuthor(id, DELETED_USER_NAME)
        return DeleteAccountResponse(deleted = true)
    }

    /** DB 최신 사용자. 존재하지 않거나 탈퇴(deletedAt != null)한 사용자의 토큰은 인증 실패로 처리한다. */
    private fun activeUser(userId: Long): User {
        val user = repo.findById(userId).orElseThrow {
            ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not found")
        }
        if (user.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not found")
        }
        return user
    }

    private companion object {
        const val DELETED_USER_NAME = "탈퇴한 사용자"
        const val DELETE_CONFIRM_TEXT = "탈퇴합니다"
    }
}

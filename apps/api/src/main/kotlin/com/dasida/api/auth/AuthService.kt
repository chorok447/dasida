package com.dasida.api.auth

import com.dasida.api.campaign.CampaignCommentRepository
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.message.DmDeletionService
import com.dasida.api.post.PostCommentRepository
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import com.dasida.api.security.TokenDenylistStore
import com.dasida.api.security.hashToken
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
    private val denylist: TokenDenylistStore,
    private val accessLogs: AccessLogService,
    private val userFollows: UserFollowRepository,
    private val dmDeletion: DmDeletionService,
    private val clock: Clock,
) {
    // 유저 없을 때 BCrypt 시간을 맞추기 위한 더미 해시(1회 계산). 타이밍 기반 가입여부 노출 방지용.
    private val dummyHash = encoder.encode("__no_such_user__")

    @Transactional
    fun signup(req: SignupRequest): IssuedTokens {
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
            repo.saveAndFlush(
                User(
                    email = email,
                    passwordHash = encoder.encode(req.password)!!,
                    name = name,
                    createdAt = Instant.now(clock),
                ),
            )
        } catch (e: DataIntegrityViolationException) {
            // 동시 요청이 사전 체크를 둘 다 통과한 경우 → unique 제약 위반을 409 로 변환(500 방지)
            throw ResponseStatusException(HttpStatus.CONFLICT, "email already registered")
        }
        return issueTokens(user)
    }

    @Transactional(readOnly = true)
    fun login(req: LoginRequest): IssuedTokens {
        val user = repo.findByEmail(req.email.trim().lowercase())
        if (user == null || user.deletedAt != null) {
            // ponytail: 유저가 없어도 BCrypt 1회 실행 → 응답시간 차이로 가입 여부가 새는 것을 방지
            encoder.matches(req.password, user?.passwordHash ?: dummyHash)
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials")
        }
        if (!encoder.matches(req.password, user.passwordHash)) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials")
        }
        // 비밀번호 검증 후에만 정지 여부를 알린다(자격 증명 없이 정지 여부가 새지 않도록).
        requireNotSuspended(user)
        return issueTokens(user)
    }

    /** 정지 계정 로그인 차단. 사용자에게 그대로 보여줄 한국어 안내를 담는다(403 body 변환은 AuthController). */
    private fun requireNotSuspended(user: User) {
        val until = user.suspendedUntil ?: return
        val now = Instant.now(clock)
        if (!until.isAfter(now)) return
        val message = if (until.isAfter(now.plus(java.time.Duration.ofDays(365L * 50)))) {
            "이용이 영구 정지된 계정입니다."
        } else {
            val untilLabel = java.time.LocalDate.ofInstant(until, java.time.ZoneId.of("Asia/Seoul"))
            "이용이 정지된 계정입니다. ($untilLabel 까지)"
        }
        throw SuspendedAccountException(message)
    }

    /**
     * refresh token 으로 access·refresh 를 재발급한다(rotation: 사용한 refresh 는 denylist 등록해
     * 재사용을 차단 — 탈취된 refresh 가 재사용되면 정당한 사용자의 다음 refresh 가 실패해 이상 징후가 된다).
     * 유효하지 않거나 denylist 에 있거나 사용자가 비활성이면 401.
     */
    @Transactional(readOnly = true)
    fun refresh(refreshToken: String): IssuedTokens {
        val userId = try {
            jwt.parseRefresh(refreshToken)
        } catch (_: Exception) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid refresh token")
        }
        // store 장애로 확인 불가면 fail-closed(denylist 정책과 동일): 무효화됐을 수 있는 refresh 를 통과시키지 않는다.
        val denied = try {
            denylist.isDenied(hashToken(refreshToken))
        } catch (_: Exception) {
            true
        }
        if (denied) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid refresh token")
        }
        val user = repo.findById(userId).orElse(null)
        if (user == null || user.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid refresh token")
        }
        // 정지 계정은 refresh 로도 세션을 연장할 수 없다.
        if (user.isSuspendedAt(Instant.now(clock))) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid refresh token")
        }
        denylist.deny(hashToken(refreshToken), jwt.remainingTtlSeconds(refreshToken))
        return issueTokens(user)
    }

    /**
     * 로그아웃. access token(필수)과 refresh token(있으면)을 만료 시간까지 denylist 에 등록해 재사용을 막는다.
     * access 는 필터에서 이미 검증된 유효 토큰만 여기 도달한다. refresh 는 검증 없이 온 쿠키 값이므로
     * 유효할 때만 등록한다(invalid 면 어차피 refresh 불가라 무시).
     */
    fun logout(token: String, refreshToken: String?): LogoutResponse {
        denylist.deny(hashToken(token), jwt.remainingTtlSeconds(token))
        refreshToken?.let {
            try {
                denylist.deny(hashToken(it), jwt.remainingTtlSeconds(it))
            } catch (_: Exception) {
                // 서명이 깨진 refresh 쿠키 — 재사용될 수 없으므로 무시
            }
        }
        return LogoutResponse(loggedOut = true)
    }

    private fun issueTokens(user: User): IssuedTokens =
        IssuedTokens(
            user.toAuthResponse(jwt.issue(user)),
            jwt.issueRefresh(user),
            requireNotNull(user.id),
        )

    @Transactional(readOnly = true)
    fun getMe(userId: Long): UserProfileResponse = repo.findActiveOrThrow(userId).toProfile()

    /** 공개 프로필 조회용. 탈퇴·미존재는 404. */
    fun publicUser(userId: Long): User {
        val user = repo.findById(userId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "user not found")
        }
        if (user.deletedAt != null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "user not found")
        }
        return user
    }

    @Transactional
    fun updateProfile(userId: Long, req: UpdateProfileRequest): UpdateProfileResponse {
        val user = repo.findActiveOrThrow(userId)
        user.name = normalizeName(req.name)
        user.profileImageUrl = normalizeProfileImageUrl(req.profileImageUrl)
        user.notifyCampaignUpdates = req.notifyCampaignUpdates
        // 기존 작성물의 author snapshot 도 최신 이름·이미지로 맞춘다. (탈퇴 시 anonymizeAuthor 와 같은 전파 패턴)
        posts.syncAuthorProfile(userId, user.name, user.profileImageUrl)
        postComments.syncAuthorProfile(userId, user.name, user.profileImageUrl)
        campaigns.syncAuthorProfile(userId, user.name, user.profileImageUrl)
        campaignComments.syncAuthorProfile(userId, user.name, user.profileImageUrl)
        return UpdateProfileResponse(token = jwt.issue(user), profile = user.toProfile())
    }

    @Transactional
    fun changePassword(userId: Long, req: ChangePasswordRequest): ChangePasswordResponse {
        val user = repo.findActiveOrThrow(userId)
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
        val user = repo.findActiveOrThrow(userId)
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
        val user = repo.findActiveOrThrow(userId)
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
        accessLogs.deleteForUser(id)
        userFollows.deleteAllForUser(id)
        dmDeletion.deleteAllForUser(id)
        return DeleteAccountResponse(deleted = true)
    }

    private companion object {
        const val DELETED_USER_NAME = "탈퇴한 사용자"
        const val DELETE_CONFIRM_TEXT = "탈퇴합니다"
    }
}

/**
 * 정지 계정 로그인 안내. 전역 정책상 ResponseStatusException 의 reason 은 에러 body 로 노출되지 않으므로
 * (ErrorResponseBodyContractTest), 사용자 안내용으로 작성된 이 메시지만 AuthController 의
 * @ExceptionHandler 가 403 body 의 detail 로 의도적으로 노출한다.
 */
class SuspendedAccountException(val detail: String) : RuntimeException(detail)

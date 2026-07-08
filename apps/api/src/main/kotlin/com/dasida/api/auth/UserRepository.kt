package com.dasida.api.auth

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException

interface UserRepository : JpaRepository<User, Long> {
    fun findByEmail(email: String): User?
    fun existsByEmail(email: String): Boolean
    fun countByDeletedAtIsNull(): Long
    fun countBySuspendedUntilAfter(now: java.time.Instant): Long

    // 관리자 회원 검색. q(소문자, 이메일/이름 부분 일치)와 정지 중 필터를 한 쿼리로 처리한다.
    @org.springframework.data.jpa.repository.Query(
        """select u from User u
           where (:q is null or lower(u.email) like concat('%', :q, '%') or lower(u.name) like concat('%', :q, '%'))
           and (:suspendedOnly = false or (u.suspendedUntil is not null and u.suspendedUntil > :now))""",
    )
    fun searchForAdmin(
        q: String?,
        suspendedOnly: Boolean,
        now: java.time.Instant,
        pageable: org.springframework.data.domain.Pageable,
    ): org.springframework.data.domain.Page<User>
}

/** DB 최신 사용자. 존재하지 않거나 탈퇴(deletedAt != null)한 사용자는 인증 실패로 처리한다. */
fun UserRepository.findActiveOrThrow(userId: Long): User {
    val user = findById(userId).orElseThrow {
        ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not found")
    }
    if (user.deletedAt != null) {
        throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not found")
    }
    return user
}

package com.dasida.api.auth

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException

interface UserRepository : JpaRepository<User, Long> {
    fun findByEmail(email: String): User?
    fun existsByEmail(email: String): Boolean
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

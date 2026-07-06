package com.dasida.api.auth

import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Clock
import java.time.Instant
import java.util.UUID

@Service
class UserBlockService(
    private val blocks: UserBlockRepository,
    private val authService: AuthService,
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun isBlockedEitherWay(a: Long, b: Long): Boolean = blocks.isBlockedEitherWay(a, b)

    @Transactional
    fun block(blockerId: Long, blockedId: Long) {
        if (blockerId == blockedId) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "cannot block yourself")
        }
        authService.publicUser(blockedId)
        if (blocks.existsByBlockerIdAndBlockedId(blockerId, blockedId)) return
        blocks.save(
            UserBlock(
                id = "ub-${UUID.randomUUID()}",
                blockerId = blockerId,
                blockedId = blockedId,
                createdAt = Instant.now(clock),
            ),
        )
    }

    @Transactional
    fun unblock(blockerId: Long, blockedId: Long) {
        blocks.deleteByBlockerIdAndBlockedId(blockerId, blockedId)
    }

    @Transactional
    fun deleteAllForUser(userId: Long) {
        blocks.deleteAllForUser(userId)
    }
}

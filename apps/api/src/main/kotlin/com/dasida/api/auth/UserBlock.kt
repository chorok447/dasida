package com.dasida.api.auth

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.Instant

@Entity
@Table(
    name = "user_blocks",
    uniqueConstraints = [UniqueConstraint(name = "uk_user_blocks_pair", columnNames = ["blocker_id", "blocked_id"])],
    indexes = [Index(name = "idx_user_blocks_blocked", columnList = "blocked_id")],
)
class UserBlock(
    @Id val id: String,
    @Column(name = "blocker_id", nullable = false) val blockerId: Long,
    @Column(name = "blocked_id", nullable = false) val blockedId: Long,
    @Column(name = "created_at", nullable = false) val createdAt: Instant,
)

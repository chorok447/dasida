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
    name = "user_follows",
    uniqueConstraints = [UniqueConstraint(name = "uk_user_follows_pair", columnNames = ["follower_id", "followee_id"])],
    indexes = [
        Index(name = "idx_user_follows_followee", columnList = "followee_id"),
        Index(name = "idx_user_follows_follower", columnList = "follower_id"),
    ],
)
class UserFollow(
    @Id val id: String,
    @Column(name = "follower_id", nullable = false) val followerId: Long,
    @Column(name = "followee_id", nullable = false) val followeeId: Long,
    @Column(name = "created_at", nullable = false) val createdAt: Instant,
)

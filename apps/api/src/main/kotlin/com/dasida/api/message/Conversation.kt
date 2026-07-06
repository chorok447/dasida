package com.dasida.api.message

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.Instant

@Entity
@Table(
    name = "conversations",
    uniqueConstraints = [UniqueConstraint(name = "uk_conversations_pair", columnNames = ["user_low_id", "user_high_id"])],
    indexes = [Index(name = "idx_conversations_updated", columnList = "updated_at")],
)
class Conversation(
    @Id val id: String,
    @Column(name = "user_low_id", nullable = false) val userLowId: Long,
    @Column(name = "user_high_id", nullable = false) val userHighId: Long,
    @Column(name = "last_message_id") var lastMessageId: String?,
    @Column(name = "updated_at", nullable = false) var updatedAt: Instant,
)

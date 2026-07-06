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
    name = "conversation_members",
    uniqueConstraints = [UniqueConstraint(name = "uk_conversation_members_pair", columnNames = ["conversation_id", "user_id"])],
    indexes = [Index(name = "idx_conversation_members_user", columnList = "user_id")],
)
class ConversationMember(
    @Id val id: String,
    @Column(name = "conversation_id", nullable = false) val conversationId: String,
    @Column(name = "user_id", nullable = false) val userId: Long,
    @Column(name = "last_read_message_id") var lastReadMessageId: String?,
    @Column(name = "joined_at", nullable = false) val joinedAt: Instant,
)

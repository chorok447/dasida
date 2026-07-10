package com.dasida.api.message

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import java.time.Instant

object MessageType {
    const val TEXT = "TEXT"
}

@Entity
@Table(
    name = "messages",
    indexes = [Index(name = "idx_messages_conversation_seq", columnList = "conversation_id, seq")],
)
class Message(
    @Id val id: String,
    @Column(name = "conversation_id", nullable = false) val conversationId: String,
    @Column(name = "sender_id", nullable = false) val senderId: Long,
    @Column(nullable = false, columnDefinition = "TEXT") val content: String,
    @Column(nullable = false) val type: String,
    @Column(name = "created_at", nullable = false) val createdAt: Instant,
    @Column(nullable = false) val seq: Long,
    // 발신자 삭제(soft delete). 본문은 보존하고 응답에서 마스킹한다(신고 대상 보존).
    @Column(name = "deleted_at") var deletedAt: Instant? = null,
)

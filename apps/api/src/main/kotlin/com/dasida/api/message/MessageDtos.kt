package com.dasida.api.message

import com.dasida.api.auth.PublicUserResponse

data class CreateConversationRequest(val peerUserId: Long)

data class ConversationSummaryResponse(
    val id: String,
    val peer: PublicUserResponse,
    val lastMessage: MessagePreview?,
    val unreadCount: Int,
    val updatedAt: String,
)

data class MessagePreview(
    val id: String,
    val content: String,
    val senderId: Long,
    val createdAt: String,
)

data class ConversationPageResponse(
    val content: List<ConversationSummaryResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

data class ConversationUnreadCountResponse(val unreadCount: Int)

data class SendMessageRequest(val content: String)

data class MessageResponse(
    val id: String,
    val senderId: Long,
    val content: String,
    val createdAt: String,
    val mine: Boolean,
)

data class MessagePageResponse(
    val content: List<MessageResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

data class MarkReadResponse(val read: Boolean)

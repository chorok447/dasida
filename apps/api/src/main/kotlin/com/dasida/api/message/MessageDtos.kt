package com.dasida.api.message

data class CreateConversationRequest(val peerUserId: Long)

/**
 * 대화 상대 요약. DM 목록/헤더는 이름·인증·아바타만 쓰므로 PublicUserResponse 의
 * 카운트·팔로우 상태(사용자당 5쿼리)를 계산하지 않는다. 전체 프로필은 /api/users/{id} 로.
 */
data class ConversationPeerResponse(
    val id: Long,
    val name: String,
    val verified: Boolean,
    val profileImageUrl: String?,
)

data class ConversationSummaryResponse(
    val id: String,
    val peer: ConversationPeerResponse,
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

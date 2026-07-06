package com.dasida.api.message

import com.dasida.api.security.AuthUser
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/messages")
@Tag(name = "Messages", description = "1:1 DM API")
class MessageController(private val messages: MessageService) {
    @Operation(summary = "대화 찾기 또는 생성")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/conversations")
    fun createConversation(
        @RequestBody req: CreateConversationRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): ConversationSummaryResponse = messages.findOrCreateConversation(user.id, req.peerUserId)

    @Operation(summary = "내 대화 목록")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/conversations")
    fun listConversations(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): ConversationPageResponse = messages.listConversations(user.id, page, size)

    @Operation(summary = "대화 미읽음 합계")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/conversations/unread-count")
    fun unreadCount(@AuthenticationPrincipal user: AuthUser): ConversationUnreadCountResponse =
        messages.unreadCount(user.id)

    @Operation(summary = "대화 상세")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/conversations/{id}")
    fun getConversation(
        @PathVariable id: String,
        @AuthenticationPrincipal user: AuthUser,
    ): ConversationSummaryResponse = messages.getConversation(user.id, id)

    @Operation(summary = "대화 메시지 목록")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/conversations/{id}/messages")
    fun listMessages(
        @PathVariable id: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "50") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): MessagePageResponse = messages.listMessages(user.id, id, page, size)

    @Operation(summary = "메시지 전송")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/conversations/{id}/messages")
    fun sendMessage(
        @PathVariable id: String,
        @RequestBody req: SendMessageRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): MessageResponse = messages.sendMessage(user.id, id, req.content)

    @Operation(summary = "대화 읽음 처리")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/conversations/{id}/read")
    fun markRead(
        @PathVariable id: String,
        @AuthenticationPrincipal user: AuthUser,
    ): MarkReadResponse = messages.markRead(user.id, id)
}

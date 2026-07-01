package com.dasida.api.campaign

import com.dasida.api.common.CommentPageLocationResponse
import com.dasida.api.security.AuthUser
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/** HTTP adapter. 인증 사용자 추출 후 Service 위임과 status code 반환만 담당한다. */
@RestController
@RequestMapping("/api/campaigns")
@Tag(name = "Campaigns", description = "캠페인 및 캠페인 댓글 API")
class CampaignController(
    private val campaignService: CampaignService,
    private val participantService: CampaignParticipantService,
    private val commentService: CampaignCommentService,
) {
    @Operation(summary = "캠페인 목록 조회", description = "공개 API. JWT 가 있으면 사용자별 참여/소유 상태를 포함한다.")
    @GetMapping
    fun list(@AuthenticationPrincipal user: AuthUser?): List<CampaignResponse> =
        campaignService.listCampaigns(user?.id)

    @Operation(summary = "캠페인 검색", description = "공개 API. JWT 가 있으면 사용자별 상태를 포함한다.")
    @GetMapping("/search")
    fun search(
        @RequestParam(name = "q", required = false) q: String?,
        @RequestParam(required = false) status: String?,
        @RequestParam(required = false) recruitState: String?,
        @RequestParam(defaultValue = "false") availableOnly: Boolean,
        @RequestParam(defaultValue = "latest") sort: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "9") size: Int,
        @RequestParam(required = false) recruitEndFrom: String?,
        @RequestParam(required = false) recruitEndTo: String?,
        @RequestParam(required = false) runStartFrom: String?,
        @RequestParam(required = false) runStartTo: String?,
        @AuthenticationPrincipal user: AuthUser?,
    ): CampaignSearchResponse = campaignService.searchCampaigns(
        user?.id, q, status, recruitState, availableOnly, sort, page, size,
        recruitEndFrom, recruitEndTo, runStartFrom, runStartTo,
    )

    @Operation(summary = "참여 캠페인 조회")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/joined")
    fun joined(@AuthenticationPrincipal user: AuthUser): List<CampaignResponse> =
        campaignService.getJoinedCampaigns(user.id)

    @Operation(summary = "내 캠페인 조회")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/mine")
    fun mine(@AuthenticationPrincipal user: AuthUser): List<CampaignResponse> =
        campaignService.getMyCampaigns(user.id)

    @Operation(summary = "참여 캠페인 조회(pagination)")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/joined/page")
    fun joinedPage(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "9") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignPageResponse = campaignService.getJoinedCampaignsPage(user.id, page, size)

    @Operation(summary = "내 캠페인 조회(pagination)")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/mine/page")
    fun minePage(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "9") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignPageResponse = campaignService.getMyCampaignsPage(user.id, page, size)

    @Operation(summary = "캠페인 상세 조회", description = "공개 API. JWT 가 있으면 사용자별 참여/소유 상태를 포함한다.")
    @GetMapping("/{id}")
    fun get(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser?): CampaignResponse =
        campaignService.getCampaign(id, user?.id)

    @Operation(summary = "참가자 목록 조회", description = "캠페인 개설자만 조회할 수 있다.")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/{id}/participants")
    fun participants(
        @PathVariable id: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignParticipantsResponse = participantService.getParticipants(user.id, id, page, size)

    @Operation(summary = "참가자 퇴장", description = "캠페인 개설자만 참가자를 퇴장시킬 수 있다.")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{id}/participants/{participantId}")
    fun removeParticipant(
        @PathVariable id: String,
        @PathVariable participantId: String,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignParticipantRemovalResponse = participantService.removeParticipant(user.id, id, participantId)

    @Operation(summary = "캠페인 참여")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/{id}/join")
    fun join(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): CampaignResponse =
        participantService.joinCampaign(user, id)

    @Operation(summary = "캠페인 참여 취소")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{id}/join")
    fun leave(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): CampaignResponse =
        participantService.leaveCampaign(user.id, id)

    @Operation(summary = "모집 상태 변경")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/{id}/status")
    fun updateStatus(
        @PathVariable id: String,
        @RequestBody req: UpdateCampaignStatusRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignResponse = campaignService.updateStatus(user.id, id, req)

    @Operation(summary = "캠페인 수정")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/{id}")
    fun update(
        @PathVariable id: String,
        @RequestBody req: UpdateCampaignRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignResponse = campaignService.updateCampaign(user.id, id, req)

    @Operation(summary = "캠페인 삭제")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser) =
        campaignService.deleteCampaign(user.id, id)

    @Operation(summary = "캠페인 작성")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@RequestBody req: CreateCampaignRequest, @AuthenticationPrincipal user: AuthUser): CampaignResponse =
        campaignService.createCampaign(user, req)

    @Operation(summary = "캠페인 댓글 조회", description = "공개 API. JWT 가 있으면 댓글 소유 여부를 포함한다.")
    @GetMapping("/{campaignId}/comments")
    fun comments(
        @PathVariable campaignId: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @AuthenticationPrincipal user: AuthUser?,
    ): CampaignCommentsResponse = commentService.listComments(campaignId, user?.id, page, size)

    @Operation(summary = "캠페인 댓글 위치 조회", description = "특정 댓글이 최신순 pagination 상 몇 번째 page 에 있는지 계산한다.")
    @GetMapping("/{campaignId}/comments/{commentId}/page")
    fun commentPageLocation(
        @PathVariable campaignId: String,
        @PathVariable commentId: String,
        @RequestParam(defaultValue = "20") size: Int,
    ): CommentPageLocationResponse = commentService.getCommentPageLocation(campaignId, commentId, size)

    @Operation(summary = "캠페인 댓글 작성")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/{campaignId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    fun addComment(
        @PathVariable campaignId: String,
        @RequestBody req: CreateCampaignCommentRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignCommentResponse = commentService.createComment(user, campaignId, req)

    @Operation(summary = "캠페인 댓글 수정")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/{campaignId}/comments/{commentId}")
    fun updateComment(
        @PathVariable campaignId: String,
        @PathVariable commentId: String,
        @RequestBody req: UpdateCampaignCommentRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignCommentResponse = commentService.updateComment(user.id, campaignId, commentId, req)

    @Operation(summary = "캠페인 댓글 삭제")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{campaignId}/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteComment(
        @PathVariable campaignId: String,
        @PathVariable commentId: String,
        @AuthenticationPrincipal user: AuthUser,
    ) = commentService.deleteComment(user.id, campaignId, commentId)
}

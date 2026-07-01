package com.dasida.api.campaign

import com.dasida.api.common.CommentPageLocationResponse
import com.dasida.api.security.AuthUser
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
class CampaignController(
    private val campaignService: CampaignService,
    private val participantService: CampaignParticipantService,
    private val commentService: CampaignCommentService,
) {
    @GetMapping
    fun list(@AuthenticationPrincipal user: AuthUser?): List<CampaignResponse> =
        campaignService.listCampaigns(user?.id)

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

    @GetMapping("/joined")
    fun joined(@AuthenticationPrincipal user: AuthUser): List<CampaignResponse> =
        campaignService.getJoinedCampaigns(user.id)

    @GetMapping("/mine")
    fun mine(@AuthenticationPrincipal user: AuthUser): List<CampaignResponse> =
        campaignService.getMyCampaigns(user.id)

    @GetMapping("/joined/page")
    fun joinedPage(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "9") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignPageResponse = campaignService.getJoinedCampaignsPage(user.id, page, size)

    @GetMapping("/mine/page")
    fun minePage(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "9") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignPageResponse = campaignService.getMyCampaignsPage(user.id, page, size)

    @GetMapping("/{id}")
    fun get(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser?): CampaignResponse =
        campaignService.getCampaign(id, user?.id)

    @GetMapping("/{id}/participants")
    fun participants(
        @PathVariable id: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignParticipantsResponse = participantService.getParticipants(user.id, id, page, size)

    @DeleteMapping("/{id}/participants/{participantId}")
    fun removeParticipant(
        @PathVariable id: String,
        @PathVariable participantId: String,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignParticipantRemovalResponse = participantService.removeParticipant(user.id, id, participantId)

    @PostMapping("/{id}/join")
    fun join(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): CampaignResponse =
        participantService.joinCampaign(user, id)

    @DeleteMapping("/{id}/join")
    fun leave(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser): CampaignResponse =
        participantService.leaveCampaign(user.id, id)

    @PutMapping("/{id}/status")
    fun updateStatus(
        @PathVariable id: String,
        @RequestBody req: UpdateCampaignStatusRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignResponse = campaignService.updateStatus(user.id, id, req)

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: String,
        @RequestBody req: UpdateCampaignRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignResponse = campaignService.updateCampaign(user.id, id, req)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: String, @AuthenticationPrincipal user: AuthUser) =
        campaignService.deleteCampaign(user.id, id)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@RequestBody req: CreateCampaignRequest, @AuthenticationPrincipal user: AuthUser): CampaignResponse =
        campaignService.createCampaign(user, req)

    @GetMapping("/{campaignId}/comments")
    fun comments(
        @PathVariable campaignId: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @AuthenticationPrincipal user: AuthUser?,
    ): CampaignCommentsResponse = commentService.listComments(campaignId, user?.id, page, size)

    @GetMapping("/{campaignId}/comments/{commentId}/page")
    fun commentPageLocation(
        @PathVariable campaignId: String,
        @PathVariable commentId: String,
        @RequestParam(defaultValue = "20") size: Int,
    ): CommentPageLocationResponse = commentService.getCommentPageLocation(campaignId, commentId, size)

    @PostMapping("/{campaignId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    fun addComment(
        @PathVariable campaignId: String,
        @RequestBody req: CreateCampaignCommentRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignCommentResponse = commentService.createComment(user, campaignId, req)

    @PutMapping("/{campaignId}/comments/{commentId}")
    fun updateComment(
        @PathVariable campaignId: String,
        @PathVariable commentId: String,
        @RequestBody req: UpdateCampaignCommentRequest,
        @AuthenticationPrincipal user: AuthUser,
    ): CampaignCommentResponse = commentService.updateComment(user.id, campaignId, commentId, req)

    @DeleteMapping("/{campaignId}/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteComment(
        @PathVariable campaignId: String,
        @PathVariable commentId: String,
        @AuthenticationPrincipal user: AuthUser,
    ) = commentService.deleteComment(user.id, campaignId, commentId)
}

package com.dasida.api.campaign

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.transaction.annotation.Transactional

interface CampaignParticipantRepository : JpaRepository<CampaignParticipant, String> {
    fun existsByCampaignIdAndUserId(campaignId: String, userId: Long): Boolean
    fun findByCampaignIdAndUserId(campaignId: String, userId: Long): CampaignParticipant?
    fun findByIdAndCampaignId(id: String, campaignId: String): CampaignParticipant?
    fun findByUserIdAndCampaignIdIn(userId: Long, campaignIds: Collection<String>): List<CampaignParticipant>
    fun findByUserId(userId: Long): List<CampaignParticipant>
    fun findByUserId(userId: Long, pageable: Pageable): Page<CampaignParticipant>
    fun findByCampaignId(campaignId: String): List<CampaignParticipant>
    fun findByCampaignId(campaignId: String, pageable: Pageable): Page<CampaignParticipant>
    fun countByCampaignId(campaignId: String): Long

    @Transactional
    fun deleteByCampaignId(campaignId: String)
}

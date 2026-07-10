package com.dasida.api.campaign

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.transaction.annotation.Transactional

interface CampaignBookmarkRepository : JpaRepository<CampaignBookmark, String> {
    fun existsByCampaignIdAndUserId(campaignId: String, userId: Long): Boolean
    fun findByCampaignIdAndUserId(campaignId: String, userId: Long): CampaignBookmark?
    fun findByUserId(userId: Long): List<CampaignBookmark>

    /** 마감 임박 알림 수신자 조회용 — 캠페인을 저장한 사용자 전체. */
    fun findByCampaignId(campaignId: String): List<CampaignBookmark>
    fun findByUserId(userId: Long, pageable: Pageable): Page<CampaignBookmark>
    fun findByUserIdAndCampaignIdIn(userId: Long, campaignIds: Collection<String>): List<CampaignBookmark>
    fun countByCampaignId(campaignId: String): Long

    @Transactional
    fun deleteByCampaignId(campaignId: String)
}

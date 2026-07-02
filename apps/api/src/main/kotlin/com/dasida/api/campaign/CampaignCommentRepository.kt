package com.dasida.api.campaign

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

interface CampaignCommentRepository : JpaRepository<CampaignComment, String> {
    fun findByCampaignId(campaignId: String, pageable: Pageable): Page<CampaignComment>
    fun findByIdAndCampaignId(id: String, campaignId: String): CampaignComment?

    @Query(
        """
        select count(c) from CampaignComment c
        where c.campaignId = :campaignId
          and (c.createdAt > :createdAt or (c.createdAt = :createdAt and c.id < :id))
        """,
    )
    fun countBeforeInNewestOrder(
        @Param("campaignId") campaignId: String,
        @Param("createdAt") createdAt: Instant,
        @Param("id") id: String,
    ): Long

    fun countByCampaignId(campaignId: String): Long

    @Transactional
    fun deleteByCampaignId(campaignId: String)

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update CampaignComment c set c.author.name = :name, c.author.verified = false where c.authorUserId = :userId")
    fun anonymizeAuthor(@Param("userId") userId: Long, @Param("name") name: String): Int
}

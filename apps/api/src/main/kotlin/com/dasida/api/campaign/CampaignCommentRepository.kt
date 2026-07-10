package com.dasida.api.campaign

import jakarta.persistence.LockModeType
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

interface CampaignCommentRepository : JpaRepository<CampaignComment, String> {
    fun findByCampaignId(campaignId: String, pageable: Pageable): Page<CampaignComment>
    fun findByIdAndCampaignId(id: String, campaignId: String): CampaignComment?

    /** 댓글 좋아요/취소 동시성 방어용 write lock 조회 — 같은 댓글에 대한 요청을 직렬화한다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CampaignComment c where c.id = :id and c.campaignId = :campaignId")
    fun findByIdAndCampaignIdForUpdate(@Param("id") id: String, @Param("campaignId") campaignId: String): CampaignComment?

    // 공개 노출 경로용(숨김 제외).
    fun findByCampaignIdAndParentIdIsNullAndHiddenAtIsNull(campaignId: String, pageable: Pageable): Page<CampaignComment>
    fun findByParentIdInAndHiddenAtIsNullOrderByCreatedAtAscIdAsc(parentIds: Collection<String>): List<CampaignComment>
    fun findByParentId(parentId: String): List<CampaignComment>

    // 최상위 댓글(답글 제외) 기준 딥링크 위치 계산.
    @Query(
        """
        select count(c) from CampaignComment c
        where c.campaignId = :campaignId
          and c.parentId is null
          and c.hiddenAt is null
          and (c.createdAt > :createdAt or (c.createdAt = :createdAt and c.id < :id))
        """,
    )
    fun countBeforeInNewestOrder(
        @Param("campaignId") campaignId: String,
        @Param("createdAt") createdAt: Instant,
        @Param("id") id: String,
    ): Long

    fun countByCampaignId(campaignId: String): Long
    fun countByCampaignIdAndHiddenAtIsNull(campaignId: String): Long

    @Transactional
    fun deleteByCampaignId(campaignId: String)

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update CampaignComment c set c.author.name = :name, c.author.verified = false, c.author.profileImageUrl = null where c.authorUserId = :userId")
    fun anonymizeAuthor(@Param("userId") userId: Long, @Param("name") name: String): Int

    /** 프로필 변경 시 기존 작성물의 author snapshot(name·이미지)을 최신 값으로 맞춘다. verified 는 유지. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update CampaignComment c set c.author.name = :name, c.author.profileImageUrl = :imageUrl where c.authorUserId = :userId")
    fun syncAuthorProfile(@Param("userId") userId: Long, @Param("name") name: String, @Param("imageUrl") imageUrl: String?): Int
}

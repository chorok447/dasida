package com.dasida.api.campaign

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.transaction.annotation.Transactional

/** countByCommentIds JPQL constructor projection 용. */
data class CampaignCommentLikeCount(val commentId: String, val likes: Long)

interface CampaignCommentLikeRepository : JpaRepository<CampaignCommentLike, String> {
    fun existsByCommentIdAndUserId(commentId: String, userId: Long): Boolean

    @Transactional
    fun deleteByCommentIdAndUserId(commentId: String, userId: Long): Long

    fun countByCommentId(commentId: String): Long

    /** 댓글 페이지(최상위+답글) 단위 좋아요 수 bulk 집계 — 댓글별 count N+1 방지. */
    @Query(
        """
        select new com.dasida.api.campaign.CampaignCommentLikeCount(cl.commentId, count(cl))
        from CampaignCommentLike cl
        where cl.commentId in :commentIds
        group by cl.commentId
        """,
    )
    fun countByCommentIds(@Param("commentIds") commentIds: Collection<String>): List<CampaignCommentLikeCount>

    /** 현재 사용자가 좋아요한 댓글 id bulk 조회 — 댓글별 exists N+1 방지. */
    @Query("select cl.commentId from CampaignCommentLike cl where cl.userId = :userId and cl.commentId in :commentIds")
    fun findLikedCommentIds(
        @Param("userId") userId: Long,
        @Param("commentIds") commentIds: Collection<String>,
    ): List<String>
}

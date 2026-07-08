package com.dasida.api.post

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.transaction.annotation.Transactional

interface PostCommentRepository : JpaRepository<PostComment, String> {
    fun findByPostIdOrderBySeqAsc(postId: String): List<PostComment>
    fun findByPostId(postId: String, pageable: Pageable): Page<PostComment>
    fun findByIdAndPostId(id: String, postId: String): PostComment?

    // 공개 노출 경로용(숨김 제외).
    fun findByPostIdAndHiddenAtIsNullOrderBySeqAsc(postId: String): List<PostComment>
    fun findByPostIdAndParentIdIsNullAndHiddenAtIsNull(postId: String, pageable: Pageable): Page<PostComment>
    fun findByParentIdInAndHiddenAtIsNullOrderBySeqAscIdAsc(parentIds: Collection<String>): List<PostComment>
    fun findByParentId(parentId: String): List<PostComment>

    // 최상위 댓글(답글 제외) 기준 딥링크 위치 계산.
    @Query(
        """
        select count(c) from PostComment c
        where c.postId = :postId
          and c.parentId is null
          and c.hiddenAt is null
          and (c.seq > :seq or (c.seq = :seq and c.id < :id))
        """,
    )
    fun countBeforeInNewestOrder(
        @Param("postId") postId: String,
        @Param("seq") seq: Long,
        @Param("id") id: String,
    ): Long

    fun countByPostId(postId: String): Long
    fun countByPostIdAndHiddenAtIsNull(postId: String): Long

    @Transactional
    fun deleteByPostId(postId: String)

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update PostComment c set c.author.name = :name, c.author.verified = false, c.author.profileImageUrl = null where c.authorUserId = :userId")
    fun anonymizeAuthor(@Param("userId") userId: Long, @Param("name") name: String): Int

    /** 프로필 변경 시 기존 작성물의 author snapshot(name·이미지)을 최신 값으로 맞춘다. verified 는 유지. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update PostComment c set c.author.name = :name, c.author.profileImageUrl = :imageUrl where c.authorUserId = :userId")
    fun syncAuthorProfile(@Param("userId") userId: Long, @Param("name") name: String, @Param("imageUrl") imageUrl: String?): Int
}

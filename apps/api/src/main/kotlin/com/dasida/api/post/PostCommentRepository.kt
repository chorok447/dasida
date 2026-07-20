package com.dasida.api.post

import jakarta.persistence.LockModeType
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.transaction.annotation.Transactional

interface PostCommentRepository : JpaRepository<PostComment, String> {
    fun findByPostIdOrderBySeqAsc(postId: String): List<PostComment>
    fun findByIdAndPostId(id: String, postId: String): PostComment?

    /** 댓글 좋아요/취소 동시성 방어용 write lock 조회 — 같은 댓글에 대한 요청을 직렬화한다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from PostComment c where c.id = :id and c.postId = :postId")
    fun findByIdAndPostIdForUpdate(@Param("id") id: String, @Param("postId") postId: String): PostComment?

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

    /**
     * 내가 댓글 단 게시글 id 페이지(최근 댓글 순, 삭제 댓글 제외). group by 라 count 쿼리를 명시한다.
     * 숨김·삭제(hiddenAt 세팅) 게시글은 쿼리에서 제외해 total 과 슬라이스가 함께 필터된다 —
     * id 만 페이지한 뒤 메모리에서 거르면 total 이 과대해 마지막 page 가 비어 보인다.
     */
    @Query(
        """
        select c.postId from PostComment c, Post p
        where p.id = c.postId and p.hiddenAt is null
          and c.authorUserId = :userId and c.deletedAt is null
        group by c.postId
        order by max(c.seq) desc
        """,
        countQuery = """
        select count(distinct c.postId) from PostComment c, Post p
        where p.id = c.postId and p.hiddenAt is null
          and c.authorUserId = :userId and c.deletedAt is null
        """,
    )
    fun findCommentedPostIds(@Param("userId") userId: Long, pageable: Pageable): Page<String>

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

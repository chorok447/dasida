package com.dasida.api.post

import jakarta.persistence.LockModeType
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

/** countByAuthorUserIdsAndHiddenAtIsNull JPQL constructor projection 용. */
data class AuthorPostCount(val authorUserId: Long?, val count: Long)

interface PostRepository : JpaRepository<Post, String> {
    fun findAllByIdInOrderBySeqDesc(ids: Collection<String>): List<Post>

    // 관리자 통계용. seq 는 작성 시각(epoch millis)이므로 기간 내 값만 가져와 일 단위로 집계한다.
    @Query("select p.seq from Post p where p.seq >= :since")
    fun creationSeqSince(@Param("since") since: Long): List<Long>

    fun findByAuthorUserIdOrderBySeqDesc(authorUserId: Long): List<Post>

    fun findByAuthorUserId(authorUserId: Long, pageable: Pageable): Page<Post>

    // 작성자 본인 목록(mine)용. 숨김은 보이지만 삭제(soft delete)는 제외한다.
    fun findByAuthorUserIdAndDeletedAtIsNullOrderBySeqDesc(authorUserId: Long): List<Post>

    fun findByAuthorUserIdAndDeletedAtIsNull(authorUserId: Long, pageable: Pageable): Page<Post>

    fun countByAuthorUserId(authorUserId: Long): Long

    /** 공개 프로필 카운트용 — 숨김·삭제(hiddenAt 세팅됨)를 제외해 공개 목록과 수치가 일치하게 한다. */
    fun countByAuthorUserIdAndHiddenAtIsNull(authorUserId: Long): Long

    /** 사용자 목록 매핑용 bulk 집계 — 작성자별 공개 게시글 수. */
    @Query(
        """
        select new com.dasida.api.post.AuthorPostCount(p.authorUserId, count(p))
        from Post p where p.authorUserId in :authorUserIds and p.hiddenAt is null
        group by p.authorUserId
        """,
    )
    fun countByAuthorUserIdsAndHiddenAtIsNull(@Param("authorUserIds") authorUserIds: Collection<Long>): List<AuthorPostCount>

    // 공개 노출 경로용(숨김 제외). 작성자 본인 목록(mine)은 위의 무필터 메서드를 그대로 쓴다.
    /** 무페이지 레거시 목록(GET /api/posts)용 상한 조회 — 전건 스캔·덤프 방지. */
    fun findByHiddenAtIsNull(pageable: Pageable): org.springframework.data.domain.Page<Post>

    fun findByAuthorUserIdAndHiddenAtIsNull(authorUserId: Long, pageable: Pageable): Page<Post>

    fun findAllByIdInAndHiddenAtIsNullOrderBySeqDesc(ids: Collection<String>): List<Post>

    /** 상호작용 동시성 방어용 write lock 조회. like/bookmark/comment 트랜잭션을 게시글별로 직렬화. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Post p where p.id = :id")
    fun findByIdForUpdate(@Param("id") id: String): Post?

    /** 캠페인 삭제 시 연결 게시글 존재 확인용. campaign_id 인덱스를 탄다. */
    fun existsByCampaignId(campaignId: String): Boolean

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Post p set p.author.name = :name, p.author.verified = false, p.author.profileImageUrl = null where p.authorUserId = :userId")
    fun anonymizeAuthor(@Param("userId") userId: Long, @Param("name") name: String): Int

    /** 프로필 변경 시 기존 작성물의 author snapshot(name·이미지)을 최신 값으로 맞춘다. verified 는 유지. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Post p set p.author.name = :name, p.author.profileImageUrl = :imageUrl where p.authorUserId = :userId")
    fun syncAuthorProfile(@Param("userId") userId: Long, @Param("name") name: String, @Param("imageUrl") imageUrl: String?): Int

    @Query("SELECT p.id FROM Post p WHERE p.hiddenAt IS NULL ORDER BY p.seq DESC, p.id ASC")
    fun findIds(pageable: Pageable): Page<String>

    /** 조회수 원자 증가. 엔티티 load-modify-save 대신 단일 UPDATE 로 동시 조회 유실을 막는다. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Post p set p.viewCount = p.viewCount + 1 where p.id = :id")
    fun incrementViewCount(@Param("id") id: String): Int
}

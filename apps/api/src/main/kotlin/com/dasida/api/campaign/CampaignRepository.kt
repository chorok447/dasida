package com.dasida.api.campaign

import jakarta.persistence.LockModeType
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface CampaignRepository : JpaRepository<Campaign, String> {
    /** 정원 동시성 방어용 write lock 조회. join 트랜잭션에서 가장 먼저 호출해 캠페인별로 직렬화. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Campaign c where c.id = :id")
    fun findByIdForUpdate(@Param("id") id: String): Campaign?

    fun findAllByIdInOrderBySeqDesc(ids: Collection<String>): List<Campaign>

    // 관리자 통계용. seq 는 개설 시각(epoch millis)이므로 기간 내 값만 가져와 일 단위로 집계한다.
    @Query("select c.seq from Campaign c where c.seq >= :since")
    fun creationSeqSince(@Param("since") since: Long): List<Long>
    fun findByAuthorUserIdOrderBySeqDesc(authorUserId: Long): List<Campaign>
    fun findByAuthorUserId(authorUserId: Long, pageable: Pageable): Page<Campaign>

    // 개설자 본인 목록(mine)용. 숨김은 보이지만 삭제(soft delete)는 제외한다.
    fun findByAuthorUserIdAndDeletedAtIsNullOrderBySeqDesc(authorUserId: Long): List<Campaign>
    fun findByAuthorUserIdAndDeletedAtIsNull(authorUserId: Long, pageable: Pageable): Page<Campaign>
    fun countByAuthorUserId(authorUserId: Long): Long

    // 공개 노출 경로용(숨김 제외). 개설자 본인 목록(mine)은 위의 무필터 메서드를 그대로 쓴다.
    /** 무페이지 레거시 목록(GET /api/campaigns)용 상한 조회 — 전건 스캔·덤프 방지. */
    fun findByHiddenAtIsNull(pageable: Pageable): org.springframework.data.domain.Page<Campaign>
    fun findAllByIdInAndHiddenAtIsNullOrderBySeqDesc(ids: Collection<String>): List<Campaign>

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Campaign c set c.author.name = :name, c.author.verified = false, c.author.profileImageUrl = null where c.authorUserId = :userId")
    fun anonymizeAuthor(@Param("userId") userId: Long, @Param("name") name: String): Int

    /** 프로필 변경 시 기존 작성물의 author snapshot(name·이미지)을 최신 값으로 맞춘다. verified 는 유지. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Campaign c set c.author.name = :name, c.author.profileImageUrl = :imageUrl where c.authorUserId = :userId")
    fun syncAuthorProfile(@Param("userId") userId: Long, @Param("name") name: String, @Param("imageUrl") imageUrl: String?): Int

    @Query("SELECT c.id FROM Campaign c WHERE c.hiddenAt IS NULL ORDER BY c.seq DESC, c.id ASC")
    fun findIds(pageable: Pageable): Page<String>
}

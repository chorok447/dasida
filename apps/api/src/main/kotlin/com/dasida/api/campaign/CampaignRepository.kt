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
    fun findByAuthorUserIdOrderBySeqDesc(authorUserId: Long): List<Campaign>
    fun findByAuthorUserId(authorUserId: Long, pageable: Pageable): Page<Campaign>

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Campaign c set c.author.name = :name, c.author.verified = false, c.author.profileImageUrl = null where c.authorUserId = :userId")
    fun anonymizeAuthor(@Param("userId") userId: Long, @Param("name") name: String): Int
}

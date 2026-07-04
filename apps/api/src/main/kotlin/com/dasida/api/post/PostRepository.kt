package com.dasida.api.post

import jakarta.persistence.LockModeType
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface PostRepository : JpaRepository<Post, String> {
    fun findAllByIdInOrderBySeqDesc(ids: Collection<String>): List<Post>

    fun findByAuthorUserIdOrderBySeqDesc(authorUserId: Long): List<Post>

    fun findByAuthorUserId(authorUserId: Long, pageable: Pageable): Page<Post>

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
}

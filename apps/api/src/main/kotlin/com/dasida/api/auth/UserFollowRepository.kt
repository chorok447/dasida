package com.dasida.api.auth

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

/** countByFolloweeIds/countByFollowerIds JPQL constructor projection 용. */
data class UserFollowCount(val userId: Long, val count: Long)

interface UserFollowRepository : JpaRepository<UserFollow, String> {
    fun existsByFollowerIdAndFolloweeId(followerId: Long, followeeId: Long): Boolean

    fun deleteByFollowerIdAndFolloweeId(followerId: Long, followeeId: Long): Long

    fun countByFolloweeId(followeeId: Long): Long

    /** 목록 매핑용 bulk 집계 — 사용자별 팔로워 수. */
    @Query(
        """
        select new com.dasida.api.auth.UserFollowCount(f.followeeId, count(f))
        from UserFollow f where f.followeeId in :userIds group by f.followeeId
        """,
    )
    fun countByFolloweeIds(@Param("userIds") userIds: Collection<Long>): List<UserFollowCount>

    /** 목록 매핑용 bulk 집계 — 사용자별 팔로잉 수. */
    @Query(
        """
        select new com.dasida.api.auth.UserFollowCount(f.followerId, count(f))
        from UserFollow f where f.followerId in :userIds group by f.followerId
        """,
    )
    fun countByFollowerIds(@Param("userIds") userIds: Collection<Long>): List<UserFollowCount>

    /** viewer 가 팔로우 중인 대상 bulk 조회 — 사용자별 exists N+1 방지. */
    @Query("select f.followeeId from UserFollow f where f.followerId = :viewerId and f.followeeId in :userIds")
    fun findFollowedIdsAmong(@Param("viewerId") viewerId: Long, @Param("userIds") userIds: Collection<Long>): List<Long>

    fun countByFollowerId(followerId: Long): Long

    fun findByFollowerId(followerId: Long, pageable: Pageable): Page<UserFollow>

    fun findByFolloweeId(followeeId: Long, pageable: Pageable): Page<UserFollow>

    @Query("select f.followeeId from UserFollow f where f.followerId = :followerId")
    fun findFolloweeIdsByFollowerId(@Param("followerId") followerId: Long): List<Long>

    @Query(
        """
        select p.authorUserId from Post p, User u
        where p.authorUserId = u.id
          and u.deletedAt is null
          and p.authorUserId is not null
          and p.authorUserId <> :viewerId
          and p.authorUserId not in (
            select f.followeeId from UserFollow f where f.followerId = :viewerId
          )
        group by p.authorUserId
        order by sum(p.likes) desc, count(p.id) desc
        """,
    )
    fun findRecommendedAuthorIds(@Param("viewerId") viewerId: Long, pageable: Pageable): List<Long>

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from UserFollow f where f.followerId = :userId or f.followeeId = :userId")
    fun deleteAllForUser(@Param("userId") userId: Long)
}

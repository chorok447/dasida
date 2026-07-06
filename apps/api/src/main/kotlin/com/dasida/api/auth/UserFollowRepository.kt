package com.dasida.api.auth

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface UserFollowRepository : JpaRepository<UserFollow, String> {
    fun existsByFollowerIdAndFolloweeId(followerId: Long, followeeId: Long): Boolean

    fun deleteByFollowerIdAndFolloweeId(followerId: Long, followeeId: Long): Long

    fun countByFolloweeId(followeeId: Long): Long

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

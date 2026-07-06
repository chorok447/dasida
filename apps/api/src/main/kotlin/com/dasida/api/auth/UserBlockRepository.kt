package com.dasida.api.auth

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface UserBlockRepository : JpaRepository<UserBlock, String> {
    fun existsByBlockerIdAndBlockedId(blockerId: Long, blockedId: Long): Boolean

    fun deleteByBlockerIdAndBlockedId(blockerId: Long, blockedId: Long): Long

    @Query(
        """
        select case when count(b) > 0 then true else false end
        from UserBlock b
        where (b.blockerId = :a and b.blockedId = :b)
           or (b.blockerId = :b and b.blockedId = :a)
        """,
    )
    fun isBlockedEitherWay(@Param("a") a: Long, @Param("b") b: Long): Boolean

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from UserBlock b where b.blockerId = :userId or b.blockedId = :userId")
    fun deleteAllForUser(@Param("userId") userId: Long)
}

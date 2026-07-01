package com.dasida.api.post

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.transaction.annotation.Transactional

interface PostLikeRepository : JpaRepository<PostLike, String> {
    fun existsByPostIdAndUserId(postId: String, userId: Long): Boolean
    fun findByPostIdAndUserId(postId: String, userId: Long): PostLike?
    fun findByUserIdAndPostIdIn(userId: Long, postIds: Collection<String>): List<PostLike>
    fun countByPostId(postId: String): Long

    @Transactional
    fun deleteByPostId(postId: String)
}

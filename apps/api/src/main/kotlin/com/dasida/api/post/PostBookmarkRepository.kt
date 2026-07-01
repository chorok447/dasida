package com.dasida.api.post

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.transaction.annotation.Transactional

interface PostBookmarkRepository : JpaRepository<PostBookmark, String> {
    fun existsByPostIdAndUserId(postId: String, userId: Long): Boolean
    fun findByPostIdAndUserId(postId: String, userId: Long): PostBookmark?
    fun findByUserId(userId: Long): List<PostBookmark>
    fun findByUserId(userId: Long, pageable: Pageable): Page<PostBookmark>
    fun findByUserIdAndPostIdIn(userId: Long, postIds: Collection<String>): List<PostBookmark>
    fun countByPostId(postId: String): Long

    @Transactional
    fun deleteByPostId(postId: String)
}

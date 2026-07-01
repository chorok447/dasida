package com.dasida.api.post

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.transaction.annotation.Transactional

interface PostCommentRepository : JpaRepository<PostComment, String> {
    fun findByPostIdOrderBySeqAsc(postId: String): List<PostComment>
    fun findByPostId(postId: String, pageable: Pageable): Page<PostComment>
    fun findByIdAndPostId(id: String, postId: String): PostComment?

    @Query(
        """
        select count(c) from PostComment c
        where c.postId = :postId
          and (c.seq > :seq or (c.seq = :seq and c.id < :id))
        """,
    )
    fun countBeforeInNewestOrder(
        @Param("postId") postId: String,
        @Param("seq") seq: Long,
        @Param("id") id: String,
    ): Long

    fun countByPostId(postId: String): Long

    @Transactional
    fun deleteByPostId(postId: String)

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update PostComment c set c.author.name = :name, c.author.verified = false where c.authorUserId = :userId")
    fun anonymizeAuthor(@Param("userId") userId: Long, @Param("name") name: String): Int
}

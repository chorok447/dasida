package com.dasida.api.post

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

/** 댓글 좋아요. (comment_id, user_id) unique 로 중복 좋아요를 막는다. 카운트는 조회 시 집계한다. */
@Entity
@Table(name = "post_comment_likes", uniqueConstraints = [UniqueConstraint(columnNames = ["comment_id", "user_id"])])
class PostCommentLike(
    @Id val id: String,
    @Column(name = "comment_id") val commentId: String,
    @Column(name = "user_id") val userId: Long,
)

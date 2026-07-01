package com.dasida.api.post

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

/** 사용자별 좋아요. (post_id, user_id) unique 로 중복 좋아요를 막는다. */
@Entity
@Table(name = "post_likes", uniqueConstraints = [UniqueConstraint(columnNames = ["post_id", "user_id"])])
class PostLike(
    @Id val id: String,
    @Column(name = "post_id") val postId: String,
    @Column(name = "user_id") val userId: Long,
)

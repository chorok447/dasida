package com.dasida.api.post

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

/** 사용자별 북마크. (post_id, user_id) unique 로 중복 북마크를 막는다. */
@Entity
@Table(
    name = "post_bookmarks",
    uniqueConstraints = [UniqueConstraint(columnNames = ["post_id", "user_id"])],
    indexes = [Index(name = "idx_post_bookmarks_user_id", columnList = "user_id")],
)
class PostBookmark(
    @Id val id: String,
    @Column(name = "post_id") val postId: String,
    @Column(name = "user_id") val userId: Long,
)

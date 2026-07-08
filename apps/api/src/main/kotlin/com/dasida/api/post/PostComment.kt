package com.dasida.api.post

import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/** 게시글 댓글. 오래된 순(seq ASC) 정렬. */
@Entity
@Table(name = "post_comments")
class PostComment(
    @Id val id: String,
    @Column(name = "post_id") val postId: String,
    @Embedded val author: Author,
    @Column(columnDefinition = "TEXT") var text: String,
    @Column(name = "time_label") val time: String,
    @JsonIgnore var seq: Long = 0,
    // 권한 판정용. author.name 은 작성 시점의 표시 이름 snapshot 이므로 사용하지 않는다.
    // 기존 댓글은 null 을 허용하며 이름 기반으로 소유권을 복구하지 않는다.
    @Column(name = "author_user_id")
    @JsonIgnore
    val authorUserId: Long? = null,
    @Column(name = "updated_at")
    var updatedAt: Instant? = null,
    // 관리자 숨김(soft hide). null = 공개. 숨김 시 post.comments 카운터도 함께 감소한다(AdminContentService).
    @Column(name = "hidden_at") @JsonIgnore var hiddenAt: Instant? = null,
    @Column(name = "hidden_reason", length = 500) @JsonIgnore var hiddenReason: String? = null,
)

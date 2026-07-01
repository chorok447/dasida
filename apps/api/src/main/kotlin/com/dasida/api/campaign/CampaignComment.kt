package com.dasida.api.campaign

import com.dasida.api.post.Author
import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(
    name = "campaign_comments",
    indexes = [
        Index(
            name = "idx_campaign_comments_campaign_created",
            columnList = "campaign_id, created_at",
        ),
    ],
)
class CampaignComment(
    @Id val id: String,
    @Column(name = "campaign_id") val campaignId: String,
    @Embedded val author: Author,
    @Column(columnDefinition = "TEXT") var text: String,
    @Column(name = "created_at") val createdAt: Instant,
    @Column(name = "author_user_id") @JsonIgnore val authorUserId: Long? = null,
    @Column(name = "updated_at") var updatedAt: Instant? = null,
)

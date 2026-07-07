package com.dasida.api.campaign

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

/** 사용자별 캠페인 북마크. (campaign_id, user_id) unique 로 중복 북마크를 막는다. */
@Entity
@Table(
    name = "campaign_bookmarks",
    uniqueConstraints = [UniqueConstraint(columnNames = ["campaign_id", "user_id"])],
    indexes = [Index(name = "idx_campaign_bookmarks_user_id", columnList = "user_id")],
)
class CampaignBookmark(
    @Id val id: String,
    @Column(name = "campaign_id") val campaignId: String,
    @Column(name = "user_id") val userId: Long,
)

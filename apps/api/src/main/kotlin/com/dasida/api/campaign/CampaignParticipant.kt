package com.dasida.api.campaign

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

/** 캠페인 참여자. (campaign_id, user_id) unique 로 중복 참여를 막는다. */
@Entity
@Table(
    name = "campaign_participants",
    uniqueConstraints = [UniqueConstraint(columnNames = ["campaign_id", "user_id"])],
    indexes = [Index(name = "idx_campaign_participants_user_id", columnList = "user_id")],
)
class CampaignParticipant(
    @Id val id: String,
    @Column(name = "campaign_id") val campaignId: String,
    @Column(name = "user_id") val userId: Long,
)

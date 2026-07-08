package com.dasida.api.campaign

import com.dasida.api.post.Author
import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

/**
 * 캠페인 참여 인증(후기). 참여자가 캠페인에서 실제로 한 일을 사진과 소감으로 남긴다.
 * 1인 1인증(campaign_id + author_user_id unique). 수정은 없고 삭제 후 재작성한다.
 */
@Entity
@Table(
    name = "campaign_proofs",
    uniqueConstraints = [
        UniqueConstraint(
            name = "uk_campaign_proofs_campaign_author",
            columnNames = ["campaign_id", "author_user_id"],
        ),
    ],
    indexes = [
        Index(
            name = "idx_campaign_proofs_campaign_created",
            columnList = "campaign_id, created_at",
        ),
    ],
)
class CampaignProof(
    @Id val id: String,
    @Column(name = "campaign_id") val campaignId: String,
    @Embedded val author: Author,
    @Column(columnDefinition = "TEXT") val text: String,
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "json") val images: List<String>,
    @Column(name = "created_at") val createdAt: Instant,
    @Column(name = "author_user_id") @JsonIgnore val authorUserId: Long,
    // 관리자 숨김(soft hide). null = 공개.
    @Column(name = "hidden_at") @JsonIgnore var hiddenAt: Instant? = null,
    @Column(name = "hidden_reason", length = 500) @JsonIgnore var hiddenReason: String? = null,
)

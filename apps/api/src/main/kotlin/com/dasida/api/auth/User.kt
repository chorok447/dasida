package com.dasida.api.auth

import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "users")
class User(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long? = null,
    @Column(unique = true) var email: String,
    @JsonIgnore var passwordHash: String,
    var name: String,
    val verified: Boolean = false,
    @Column(name = "profile_image_url", length = 500) var profileImageUrl: String? = null,
    @Column(name = "notify_campaign_updates", nullable = false) var notifyCampaignUpdates: Boolean = true,
    @Column(name = "deleted_at") @JsonIgnore var deletedAt: Instant? = null,
)

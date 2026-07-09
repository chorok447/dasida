package com.dasida.api.auth

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(
    name = "user_access_logs",
    indexes = [Index(name = "idx_user_access_logs_user_accessed", columnList = "user_id,accessed_at")],
)
class UserAccessLog(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long? = null,
    @Column(name = "user_id", nullable = false) val userId: Long,
    @Column(name = "ip_address", nullable = false, length = 45) val ipAddress: String,
    @Column(nullable = false, length = 32) val os: String,
    // V16 이전 기록은 null(수집 이전). 브라우저는 User-Agent 파싱, 국가·지역은 IP 기반 비동기 조회.
    @Column(length = 32) val browser: String? = null,
    @Column(length = 64) var country: String? = null,
    @Column(length = 64) var region: String? = null,
    @Column(name = "accessed_at", nullable = false) val accessedAt: Instant,
)

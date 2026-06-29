package com.dasida.api.campaign

import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

@TestConfiguration(proxyBeanMethods = false)
class FixedClockTestConfiguration {
    @Bean
    @Primary
    fun fixedCampaignClock(): Clock = Clock.fixed(
        Instant.parse("2026-07-15T00:00:00Z"),
        ZoneId.of("Asia/Seoul"),
    )
}

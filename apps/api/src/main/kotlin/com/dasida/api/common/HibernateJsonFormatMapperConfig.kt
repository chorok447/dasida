package com.dasida.api.common

import org.hibernate.cfg.AvailableSettings
import org.hibernate.type.format.jackson.Jackson3JsonFormatMapper
import org.springframework.boot.hibernate.autoconfigure.HibernatePropertiesCustomizer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import tools.jackson.databind.json.JsonMapper

/**
 * Hibernate @JdbcTypeCode(JSON) 기본 경로는 Jackson 2 [JacksonJsonFormatMapper]를 사용한다.
 * Boot 4 Jackson 3 전환 후 Kotlin JSON 타입(CampaignBody 등) 역직렬화를 위해
 * auto-configured [JsonMapper](kotlin module v3 포함)를 Hibernate JSON FormatMapper에 연결한다.
 */
@Configuration
class HibernateJsonFormatMapperConfig {
    @Bean
    fun jackson3JsonFormatMapperCustomizer(jsonMapper: JsonMapper): HibernatePropertiesCustomizer =
        HibernatePropertiesCustomizer { properties ->
            properties[AvailableSettings.JSON_FORMAT_MAPPER] = Jackson3JsonFormatMapper(jsonMapper)
        }
}

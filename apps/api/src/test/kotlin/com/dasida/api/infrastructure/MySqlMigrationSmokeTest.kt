package com.dasida.api.infrastructure

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.testcontainers.service.connection.ServiceConnection
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.TestPropertySource
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers

/**
 * Flyway 마이그레이션의 유일한 실 DB 검증 지점. 평소 테스트는 H2 + create-drop 이라
 * MySQL 전용 마이그레이션 SQL 이 깨져도 전체 스위트가 통과하고, 배포(prod 는 flyway +
 * ddl-auto=validate) 첫 부팅에서야 터졌다 — 그 간극을 여기서 메운다.
 *
 * 검증 내용: (1) 전체 V*.sql 이 실제 MySQL 8 에 적용된다, (2) 적용된 스키마가
 * JPA 엔티티와 일치한다(ddl-auto=validate 로 컨텍스트가 뜨는 것 자체가 검증).
 * Docker 가 없으면 스킵된다(로컬 개발 편의).
 */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
@TestPropertySource(
    properties = [
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
    ],
)
class MySqlMigrationSmokeTest(
    @param:Autowired private val jdbc: JdbcTemplate,
) {
    companion object {
        // 운영과 같은 메이저 라인(compose 의 mysql:8.4)으로 고정한다.
        @Container
        @ServiceConnection
        @JvmStatic
        val mysql = MySQLContainer("mysql:8.4")
    }

    @Test
    fun `모든 Flyway 마이그레이션이 실제 MySQL 에 적용되고 JPA 스키마 검증을 통과한다`() {
        // 컨텍스트가 떴다는 것 = flyway 적용 + ddl validate 통과. 이력이 실제로 쌓였는지만 확인한다.
        val applied = jdbc.queryForObject(
            "select count(*) from flyway_schema_history where success = 1",
            Long::class.java,
        )
        assertThat(applied).isGreaterThanOrEqualTo(17)
    }

    @Test
    fun `최신 마이그레이션 컬럼이 존재한다 - users_credentials_changed_at`() {
        val count = jdbc.queryForObject(
            """
            select count(*) from information_schema.columns
            where table_schema = database() and table_name = 'users' and column_name = 'credentials_changed_at'
            """.trimIndent(),
            Long::class.java,
        )
        assertThat(count).isEqualTo(1)
    }
}

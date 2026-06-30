package com.dasida.api

import org.springframework.boot.CommandLineRunner
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component

/** 기존 통합 테스트의 고정 userId JWT가 실제 활성 사용자 row를 가리키게 한다. */
@Component
class TestUserSeed(private val jdbc: JdbcTemplate) : CommandLineRunner {
    override fun run(vararg args: String?) {
        TEST_USER_IDS.forEach { id ->
            val exists = jdbc.queryForObject("select count(*) from users where id = ?", Long::class.java, id) != 0L
            if (!exists) {
                jdbc.update(
                    "insert into users (id, email, password_hash, name, verified, deleted_at) values (?, ?, ?, ?, ?, ?)",
                    id,
                    "test-user-$id@dasida.local",
                    "test-only",
                    "테스트 사용자 $id",
                    false,
                    null,
                )
            }
        }
    }

    private companion object {
        val TEST_USER_IDS = listOf(
            1L, 2L, 4L, 9L,
            101L, 102L, 201L, 211L, 212L, 301L, 302L,
            401L, 402L, 411L, 412L, 421L, 422L, 431L, 432L,
            501L, 601L, 602L, 701L, 711L, 712L, 721L, 722L, 731L,
            801L, 802L, 821L, 831L, 901L, 902L,
        )
    }
}

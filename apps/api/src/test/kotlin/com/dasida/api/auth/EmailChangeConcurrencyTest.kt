package com.dasida.api.auth

import com.dasida.api.security.JwtService
import tools.jackson.databind.json.JsonMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.put
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@SpringBootTest
@AutoConfigureMockMvc
class EmailChangeConcurrencyTest(
    @param:Autowired private val mvc: MockMvc,
    @param:Autowired private val users: UserRepository,
    @param:Autowired private val encoder: PasswordEncoder,
    @param:Autowired private val jwt: JwtService,
    @param:Autowired private val mapper: JsonMapper,
) {
    @Test
    fun `두 사용자가 같은 이메일로 동시에 변경하면 하나만 200이고 다른 요청은 409`() {
        val suffix = UUID.randomUUID().toString()
        val password = "Current1!"
        val first = users.saveAndFlush(
            User(email = "email-race-a-$suffix@dasida.com", passwordHash = encoder.encode(password)!!, name = "A"),
        )
        val second = users.saveAndFlush(
            User(email = "email-race-b-$suffix@dasida.com", passwordHash = encoder.encode(password)!!, name = "B"),
        )
        val target = "email-race-target-$suffix@dasida.com"
        val barrier = CyclicBarrier(2)
        val pool = Executors.newFixedThreadPool(2)

        try {
            val futures = listOf(first, second).map { user ->
                pool.submit(
                    Callable {
                        barrier.await(5, TimeUnit.SECONDS)
                        mvc.put("/api/auth/email") {
                            headers { add("Authorization", "Bearer ${jwt.issue(user)}") }
                            contentType = MediaType.APPLICATION_JSON
                            content = mapper.writeValueAsString(ChangeEmailRequest(password, target))
                        }.andReturn().response.status
                    },
                )
            }

            assertThat(futures.map { it.get(10, TimeUnit.SECONDS) }.sorted()).containsExactly(200, 409)
            val saved = users.findAllById(listOf(requireNotNull(first.id), requireNotNull(second.id)))
            assertThat(saved.count { it.email == target }).isEqualTo(1)
        } finally {
            pool.shutdownNow()
            users.deleteAllById(listOf(requireNotNull(first.id), requireNotNull(second.id)))
        }
    }
}

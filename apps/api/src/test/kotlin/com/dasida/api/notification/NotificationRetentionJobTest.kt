package com.dasida.api.notification

import com.dasida.api.common.SeqGenerator
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.data.domain.PageRequest
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

@SpringBootTest
@Transactional
class NotificationRetentionJobTest(
    @param:Autowired private val job: NotificationRetentionJob,
    @param:Autowired private val repo: NotificationRepository,
    @param:Autowired private val clock: Clock,
) {
    private val userId = 7777L

    private fun save(createdAt: Instant, readAt: Instant?): String {
        val id = "ret-${UUID.randomUUID()}"
        repo.saveAndFlush(
            Notification(
                id = id,
                userId = userId,
                type = NotificationType.POST_LIKED,
                title = "보존 테스트",
                body = "본문",
                href = "/posts/p1",
                readAt = readAt,
                createdAt = createdAt,
                time = "방금 전",
                seq = SeqGenerator.next(),
            ),
        )
        return id
    }

    @Test
    fun `읽은 지 30일 지난 알림과 생성 180일 지난 미읽음 알림만 삭제한다`() {
        val now = Instant.now(clock)
        val oldRead = save(createdAt = now.minus(40, ChronoUnit.DAYS), readAt = now.minus(31, ChronoUnit.DAYS))
        val recentRead = save(createdAt = now.minus(40, ChronoUnit.DAYS), readAt = now.minus(5, ChronoUnit.DAYS))
        val ancientUnread = save(createdAt = now.minus(181, ChronoUnit.DAYS), readAt = null)
        val recentUnread = save(createdAt = now.minus(10, ChronoUnit.DAYS), readAt = null)

        job.purgeExpired()

        val remaining = repo.findByUserId(userId, PageRequest.of(0, 50)).content.map { it.id }
        assertThat(remaining).containsExactlyInAnyOrder(recentRead, recentUnread)
        assertThat(remaining).doesNotContain(oldRead, ancientUnread)
    }
}

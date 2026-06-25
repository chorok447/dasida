package com.dasida.api.notification

import com.dasida.api.common.Photos
import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@Entity
@Table(name = "notifications")
class Notification(
    @Id val id: String,
    val kind: String, // "like" | "comment" | "campaign" | "system"
    val title: String,
    @Column(columnDefinition = "TEXT") val body: String,
    @Column(name = "time_label") val time: String,
    val unread: Boolean,
    val thumb: String? = null,
    @JsonIgnore var seq: Long = 0, // 정렬용. 시드=인덱스
)

interface NotificationRepository : JpaRepository<Notification, String>

/**
 * 초기 적재 시드. apps/web/src/data/notifications.ts 와 1:1 미러. SeedRunner 가 비어있을 때만 저장.
 */
object NotificationSeed {
    private val fashion = Photos.fashion
    private val obj = Photos.obj
    private val people = Photos.people
    private val nature = Photos.nature

    val notifications: List<Notification> = listOf(
        Notification("n1", "like", "금잔디님이 좋아합니다", "낡은 청바지 두 벌로 토트백 한 개...", "5분 전", true, fashion[0]),
        Notification("n2", "comment", "익명의 고슴도치님이 댓글을 남겼습니다", "혹시 판매하실 의향도 있으신가요?", "1시간 전", true, obj[0]),
        Notification("n3", "campaign", "캠페인이 시작되었습니다", "한강공원 플로깅 데이가 곧 시작됩니다.", "3시간 전", true, people[0]),
        Notification("n4", "like", "초록도시님이 좋아합니다", "오늘은 옥상 텃밭에 토마토를 옮겨...", "어제", false, nature[1]),
        Notification("n5", "comment", "리룸님이 댓글을 남겼습니다", "다음 마켓에서도 함께해요!", "2일 전", false, fashion[2]),
        Notification("n6", "campaign", "관심 캠페인이 마감됩니다", "유리병 캔들 메이킹 D-1", "3일 전", false, obj[3]),
        Notification("n7", "system", "비밀번호 변경 완료", "보안을 위해 정기적으로 변경해주세요.", "1주 전", false),
        Notification("n8", "system", "다시,다 v1.2 업데이트", "캠페인 알림 기능이 개선되었습니다.", "2주 전", false),
    )
}

@RestController
@RequestMapping("/api/notifications")
class NotificationController(private val repo: NotificationRepository) {
    @GetMapping
    fun list(): List<Notification> = repo.findAll(Sort.by(Sort.Direction.DESC, "seq"))
}

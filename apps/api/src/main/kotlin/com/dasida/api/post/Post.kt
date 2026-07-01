package com.dasida.api.post

import com.dasida.api.common.Photos
import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes

@Embeddable
class Author(
    var name: String = "",
    var verified: Boolean = false,
)

@Entity
@Table(
    name = "posts",
    indexes = [
        Index(name = "idx_posts_author_user_id", columnList = "author_user_id"),
        // 캠페인 삭제 시 연결 게시글 존재 확인(existsByCampaignId)을 위한 조회용 인덱스.
        Index(name = "idx_posts_campaign_id", columnList = "campaign_id"),
    ],
)
class Post(
    @Id val id: String,
    @Embedded val author: Author,
    @Column(name = "time_label") val time: String,
    // text/tags/images/campaignId 는 수정 API(PUT)에서 갱신되므로 var. 정렬·소유권 필드(seq/time/authorUserId)는 불변.
    @Column(name = "content", columnDefinition = "TEXT") var text: String,
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "json") var tags: List<String>,
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "json") var images: List<String>,
    var likes: Int,
    var comments: Int,
    var campaignId: String? = null,
    @JsonIgnore var seq: Long = 0, // 정렬용. 시드=인덱스, 생성=epoch millis (최신이 위로)
    // 작성자 소유권 판단용. author.name 은 작성 당시 표시 이름 snapshot 이므로 소유권엔 쓰지 않는다.
    // 시드/기존 게시글은 null(소유자 없음). 이름 기반 backfill 하지 않는다.
    @Column(name = "author_user_id") @JsonIgnore val authorUserId: Long? = null,
)

/**
 * 초기 적재 시드. apps/web/src/data/posts.ts 와 1:1 미러. SeedRunner 가 비어있을 때만 저장.
 */
object PostSeed {
    private val workshop = Photos.workshop
    private val nature = Photos.nature
    private val fashion = Photos.fashion
    private val market = Photos.market
    private val people = Photos.people
    private val obj = Photos.obj

    val posts: List<Post> = listOf(
        Post("p1", Author("김다시", true), "2시간 전",
            "낡은 청바지 두 벌로 토트백 한 개. 박음질 시간은 두 시간, 만족감은 일주일.",
            listOf("#청바지업사이클", "#손바느질"), listOf(fashion[0], fashion[2]), 142, 18, "c1"),
        Post("p2", Author("초록도시", false), "5시간 전",
            "오늘은 옥상 텃밭에 토마토를 옮겨 심었어요. 페트병 화분이 의외로 잘 자랍니다.",
            listOf("#도시텃밭", "#페트병"), listOf(nature[1], nature[4]), 89, 7),
        Post("p3", Author("보틀앤캔들", true), "어제",
            "버려진 와인병에 향을 담아 캔들로. 다음 주 공방 클래스 모집 시작합니다.",
            listOf("#캔들", "#유리병", "#클래스"), listOf(obj[0], obj[3]), 256, 32, "c7"),
        Post("p4", Author("한강러너스", true), "2일 전",
            "토요일 플로깅 후기. 두 시간 동안 40L 쓰레기 봉투 6개. 함께 뛴 분들 감사합니다 🌱",
            listOf("#플로깅", "#한강"), listOf(people[0]), 410, 56, "c2"),
        Post("p5", Author("리메이크목공방", false), "3일 전",
            "버려진 책상 상판으로 작은 의자 두 개. 결을 살리는 데에 사흘.",
            listOf("#목공", "#가구업사이클"), listOf(workshop[2], workshop[5]), 178, 14, "c8"),
        Post("p6", Author("리룸", true), "4일 전",
            "지난 마켓에서 모인 옷 312벌. 다음 마켓은 8월 둘째 주, 자세한 일정 곧 공유드릴게요.",
            listOf("#기증마켓", "#리룸"), listOf(market[1], market[4]), 134, 9),
        Post("p7", Author("이연두", false), "5일 전",
            "엄마 옷장에서 꺼낸 80년대 셔츠를 크롭으로 줄였습니다. 30년 묵은 핏이 의외로 멋져요.",
            listOf("#리폼", "#빈티지"), listOf(fashion[5], fashion[6]), 92, 11),
        Post("p8", Author("원두모음", false), "1주 전",
            "커피박 비누 만들기 기록. 카페에서 받은 찌꺼기로 30개 비누 완성.",
            listOf("#커피박", "#비누"), listOf(obj[1], obj[4]), 201, 22, "c6"),
        Post("p9", Author("서울도시농부", false), "1주 전",
            "버려진 우유팩으로 모종 트레이를 만들어 봤어요. 봄에 옮길 모종 100개 준비 완료.",
            listOf("#도시농부", "#우유팩"), listOf(nature[2]), 64, 5),
        Post("p10", Author("다시다시", true), "2주 전",
            "댕댕이 교복 캠페인 작업 중간 점검. 39명이 함께 만들고 있습니다.",
            listOf("#댕교복", "#함께만들기"), listOf(people[3], people[5]), 320, 41, "c1"),
    )
}

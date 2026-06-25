package com.dasida.api.post

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

data class Author(val name: String, val verified: Boolean)

data class Post(
    val id: String,
    val author: Author,
    val time: String,
    val text: String,
    val tags: List<String>,
    val images: List<String>,
    val likes: Int,
    val comments: Int,
    val campaignId: String? = null,
)

/**
 * 인메모리 시드. apps/web/src/data/posts.ts 와 1:1 미러.
 * DB 도입 시 Repository 로 교체. (ponytail: 인메모리, DB는 실제 영속화 필요할 때)
 */
object PostSeed {
    // photos.ts 의 u() 헬퍼 + 풀을 그대로 재현.
    private fun u(id: String, w: Int = 900) =
        "https://images.unsplash.com/$id?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=$w&q=80"

    private val workshop = listOf(
        "photo-1606501126768-b78d4569d3f9", "photo-1457972657980-4c9fddebec8d",
        "photo-1641320197434-6ae0ca235048", "photo-1568288796918-03e7d93306bd",
        "photo-1586216583645-bf798306a3d7", "photo-1672302255324-28009cc288b2",
        "photo-1701188516156-10b389bb8e94", "photo-1644288054812-aa3ec742c419",
    ).map { u(it) }

    private val nature = listOf(
        "photo-1745327656782-30099136da9c", "photo-1588440691140-09155c1be58a",
        "photo-1613498630970-f2a333cb4974", "photo-1701270631258-ca1a2edbd9c5",
        "photo-1519563161591-80eebb119acc", "photo-1685606350130-2176a0ec7296",
        "photo-1619805640532-21cce5fe542b", "photo-1745063537934-e6bf484d72eb",
    ).map { u(it) }

    private val fashion = listOf(
        "photo-1778554986659-741bb4c610a8", "photo-1587088507715-c7705faa3d27",
        "photo-1588195415442-3ea1e61e1322", "photo-1587761383903-4ed7d428e746",
        "photo-1587797283885-9a123e3e88a0", "photo-1778512397881-51b00202ddde",
        "photo-1750343293522-2f08b60a317a", "photo-1615292215322-84c7b9ec441b",
    ).map { u(it) }

    private val market = listOf(
        "photo-1640684666381-2e4a56056a0d", "photo-1726572330396-0947f571ac19",
        "photo-1780461475878-17d8c3108857", "photo-1685875018097-3a93223dfac8",
        "photo-1761926783284-6de41a58736d", "photo-1685883518233-4b355cf80a08",
        "photo-1780775119744-f493340e9f79", "photo-1781730441165-069bffd27f90",
    ).map { u(it) }

    private val people = listOf(
        "photo-1758599668299-beebedfabf7b", "photo-1624971035514-2bbbc81ea9fe",
        "photo-1758599668356-c8c919e24dda", "photo-1758599668178-d9716bbda9d5",
        "photo-1616680213875-8c6cbae0b933", "photo-1597700112072-fa3c1d930655",
        "photo-1758599669199-a858720a9689", "photo-1758599667729-a6f0f8bd213b",
    ).map { u(it) }

    private val obj = listOf(
        "photo-1603905179139-db12ab535ca9", "photo-1612179543058-ab74d388e0ce",
        "photo-1603897076223-17f346f02a03", "photo-1718788392540-0862a47c8c30",
        "photo-1725169412537-acd1cd15e10f", "photo-1724570568441-9755d8e8b6e2",
        "photo-1721190601155-1b98d316bbe2", "photo-1728551040634-db461e235b1f",
    ).map { u(it) }

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

@RestController
@RequestMapping("/api/posts")
class PostController {
    @GetMapping
    fun list(): List<Post> = PostSeed.posts

    @GetMapping("/{id}")
    fun get(@PathVariable id: String): Post =
        PostSeed.posts.find { it.id == id }
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "post $id not found")
}

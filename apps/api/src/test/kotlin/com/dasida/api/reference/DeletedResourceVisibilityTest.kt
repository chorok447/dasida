package com.dasida.api.reference

import com.dasida.api.auth.User
import com.dasida.api.campaign.Campaign
import com.dasida.api.campaign.CampaignBody
import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.post.Author
import com.dasida.api.post.Post
import com.dasida.api.post.PostRepository
import com.dasida.api.security.JwtService
import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * 삭제된 리소스의 조회 경로 비노출 회귀 방지.
 *
 * DELETE 는 hard delete 라 삭제된 게시글/캠페인은 어떤 조회 경로에도 다시 나타나면 안 된다. 기존 테스트는
 * 게시글 상세 404(작성자가 삭제하면 이후 조회는 404), 캠페인 mine 제외/row 제거만 고정한다. 다만 **목록/검색**
 * 재노출과 게시글 **mine** 재노출, 캠페인 **상세 404** 는 고정되지 않았다. soft delete 로 회귀하면 상세 404 만으로는
 * 목록/검색 재노출을 잡지 못하므로 대표 조회 경로 전반에서 비노출을 고정한다.
 * (삭제된 parent 하위 리소스 생성 불가는 PR #83, 캠페인 mine 제외/재삭제 404 는 CampaignControllerTest 가
 *  이미 고정하므로 중복하지 않는다.)
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DeletedResourceVisibilityTest(
    @Autowired private val mvc: MockMvc,
    @Autowired private val jwt: JwtService,
    @Autowired private val posts: PostRepository,
    @Autowired private val campaigns: CampaignRepository,
) {
    private val token = jwt.issue(User(id = 1, email = "me@test.com", passwordHash = "x", name = "나"))

    private fun savePost(marker: String): String {
        val id = "del-post-${UUID.randomUUID()}"
        posts.saveAndFlush(
            Post(
                id, Author("작성자", false), "방금", "본문 $marker", emptyList(), emptyList(), 0, 0,
                seq = 1, authorUserId = 1,
            ),
        )
        return id
    }

    private fun saveDeletableCampaign(marker: String): String {
        val id = "del-camp-${UUID.randomUUID()}"
        campaigns.saveAndFlush(
            Campaign(
                id, "upcoming", "캠페인 $marker", "요약", "",
                "2026-08-01", "2026-08-31", "2026-09-01", "2026-09-30",
                capacity = 10, joined = 0, daysLeftLabel = "모집 예정",
                author = Author("개설자", false),
                body = CampaignBody("소개", emptyList(), emptyList()),
                seq = 1, authorUserId = 1,
            ),
        )
        return id
    }

    @Test
    fun `삭제된 게시글은 목록 검색 내 게시글에서 모두 제외된다`() {
        val marker = "delmark${UUID.randomUUID().toString().take(8)}"
        val id = savePost(marker)

        mvc.delete("/api/posts/$id") {
            headers { add("Authorization", "Bearer $token") }
        }.andExpect { status { isNoContent() } }

        mvc.get("/api/posts").andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$id')]") { value(Matchers.empty<Any>()) }
        }
        mvc.get("/api/posts/search") { param("q", marker) }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(0) }
        }
        mvc.get("/api/posts/mine") { headers { add("Authorization", "Bearer $token") } }.andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$id')]") { value(Matchers.empty<Any>()) }
        }
    }

    @Test
    fun `삭제된 캠페인은 목록 검색에서 제외되고 상세는 404다`() {
        val marker = "delmark${UUID.randomUUID().toString().take(8)}"
        val id = saveDeletableCampaign(marker)

        mvc.delete("/api/campaigns/$id") {
            headers { add("Authorization", "Bearer $token") }
        }.andExpect { status { isNoContent() } }

        mvc.get("/api/campaigns").andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$id')]") { value(Matchers.empty<Any>()) }
        }
        mvc.get("/api/campaigns/search") { param("q", marker) }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(0) }
        }
        mvc.get("/api/campaigns/$id").andExpect { status { isNotFound() } }
    }
}

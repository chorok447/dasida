package com.dasida.api.post

import org.hamcrest.Matchers
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PostSitemapIdsTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val posts: PostRepository,
) {
    @Test
    fun `sitemap ids 는 id 만 반환한다`() {
        val id = "smap-${UUID.randomUUID()}"
        posts.save(
            Post(
                id,
                Author("작성자", false),
                "방금",
                "본문",
                emptyList(),
                emptyList(),
                0,
                0,
                seq = System.currentTimeMillis(),
            ),
        )

        mvc.get("/api/posts/sitemap-ids?page=0&size=10")
            .andExpect { status { isOk() } }
            .andExpect { jsonPath("$.ids", Matchers.hasItem(id)) }
            .andExpect { jsonPath("$.text") { doesNotExist() } }
    }
}

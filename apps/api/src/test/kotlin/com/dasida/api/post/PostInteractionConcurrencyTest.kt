package com.dasida.api.post

import com.dasida.api.auth.User
import com.dasida.api.security.JwtService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * 게시글 좋아요/댓글 카운터 동시성을 실제 두 thread 로 검증. 클래스에 @Transactional 을 붙이지 않아
 * worker thread 가 commit 된 데이터를 보고 각자 별도 트랜잭션/커넥션으로 post row lock 을 경쟁한다.
 * CampaignJoinConcurrencyTest 패턴(CyclicBarrier 동시 출발, sleep 미사용, timeout 보장)을 따른다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class PostInteractionConcurrencyTest(
    @Autowired val mvc: MockMvc,
    @Autowired val jwt: JwtService,
    @Autowired val postRepo: PostRepository,
    @Autowired val likeRepo: PostLikeRepository,
    @Autowired val bookmarkRepo: PostBookmarkRepository,
    @Autowired val commentRepo: PostCommentRepository,
) {
    private fun tokenFor(userId: Long) = jwt.issue(
        User(id = userId, email = "u$userId@t.com", passwordHash = "x", name = "유저$userId", verified = false),
    )

    private fun savePost(likes: Int = 0, comments: Int = 0): String {
        val id = "pc-${UUID.randomUUID()}"
        // worker thread 가 볼 수 있도록 commit 된 상태로 저장.
        postRepo.saveAndFlush(
            Post(id, Author("작성자", false), "방금", "본문", emptyList(), emptyList(), likes, comments),
        )
        return id
    }

    /** N개의 요청을 동시에 시작시키고 각 HTTP status 를 모은다. */
    private fun concurrently(count: Int, action: (Int) -> Int): List<Int> {
        val barrier = CyclicBarrier(count)
        val pool = Executors.newFixedThreadPool(count)
        try {
            val futures = (0 until count).map { i ->
                pool.submit(
                    Callable {
                        barrier.await(5, TimeUnit.SECONDS) // 동시 출발
                        action(i)
                    },
                )
            }
            return futures.map { it.get(10, TimeUnit.SECONDS) }
        } finally {
            pool.shutdownNow()
        }
    }

    private fun likeStatus(id: String, token: String): Int =
        mvc.post("/api/posts/$id/like") { headers { add("Authorization", "Bearer $token") } }
            .andReturn().response.status

    private fun unlikeStatus(id: String, token: String): Int =
        mvc.delete("/api/posts/$id/like") { headers { add("Authorization", "Bearer $token") } }
            .andReturn().response.status

    private fun bookmarkStatus(id: String, token: String): Int =
        mvc.post("/api/posts/$id/bookmark") { headers { add("Authorization", "Bearer $token") } }
            .andReturn().response.status

    private fun commentStatus(id: String, token: String, text: String): Int =
        mvc.post("/api/posts/$id/comments") {
            headers { add("Authorization", "Bearer $token") }
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"$text"}"""
        }.andReturn().response.status

    private fun cleanup(id: String) {
        likeRepo.deleteByPostId(id)
        bookmarkRepo.deleteByPostId(id)
        commentRepo.deleteByPostId(id)
        postRepo.deleteById(id)
    }

    @Test
    fun `서로 다른 두 사용자가 동시에 좋아요하면 둘 다 반영된다`() {
        val id = savePost(likes = 0)
        val tokens = listOf(tokenFor(401), tokenFor(402))
        try {
            val statuses = concurrently(2) { likeStatus(id, tokens[it]) }

            assertThat(statuses).containsExactly(200, 200)
            assertThat(postRepo.findById(id).get().likes).isEqualTo(2)
            assertThat(likeRepo.countByPostId(id)).isEqualTo(2)
        } finally {
            cleanup(id)
        }
    }

    @Test
    fun `같은 사용자가 동시에 두 번 좋아요해도 idempotent 하다`() {
        val id = savePost(likes = 0)
        val token = tokenFor(411)
        try {
            val statuses = concurrently(2) { likeStatus(id, token) }

            assertThat(statuses).containsExactly(200, 200)
            assertThat(postRepo.findById(id).get().likes).isEqualTo(1)
            assertThat(likeRepo.countByPostId(id)).isEqualTo(1)
        } finally {
            cleanup(id)
        }
    }

    @Test
    fun `같은 사용자가 동시에 두 번 북마크해도 idempotent 하다`() {
        val id = savePost()
        val token = tokenFor(412)
        try {
            val statuses = concurrently(2) { bookmarkStatus(id, token) }

            assertThat(statuses).containsExactly(200, 200)
            assertThat(bookmarkRepo.countByPostId(id)).isEqualTo(1)
        } finally {
            cleanup(id)
        }
    }

    @Test
    fun `서로 다른 두 사용자가 동시에 댓글을 작성하면 둘 다 반영된다`() {
        val id = savePost(comments = 0)
        val tokens = listOf(tokenFor(421), tokenFor(422))
        try {
            val statuses = concurrently(2) { commentStatus(id, tokens[it], "댓글$it") }

            assertThat(statuses).containsExactly(201, 201)
            assertThat(postRepo.findById(id).get().comments).isEqualTo(2)
            assertThat(commentRepo.countByPostId(id)).isEqualTo(2)
            mvc.get("/api/posts/$id/comments").andExpect { jsonPath("$.length()") { value(2) } }
        } finally {
            cleanup(id)
        }
    }

    @Test
    fun `서로 다른 두 사용자가 동시에 좋아요 취소하면 둘 다 감소한다`() {
        val id = savePost(likes = 2)
        // 두 유저가 이미 좋아요한 상태를 commit.
        likeRepo.saveAndFlush(PostLike("plk-${UUID.randomUUID()}", id, 431))
        likeRepo.saveAndFlush(PostLike("plk-${UUID.randomUUID()}", id, 432))
        val tokens = listOf(tokenFor(431), tokenFor(432))
        try {
            val statuses = concurrently(2) { unlikeStatus(id, tokens[it]) }

            assertThat(statuses).containsExactly(200, 200)
            assertThat(postRepo.findById(id).get().likes).isEqualTo(0)
            assertThat(likeRepo.countByPostId(id)).isEqualTo(0)
        } finally {
            cleanup(id)
        }
    }
}

package com.dasida.api.media

import com.dasida.api.auth.User
import com.dasida.api.auth.UserRepository
import com.dasida.api.security.AuthCookies
import com.dasida.api.security.JwtService
import jakarta.servlet.http.Cookie
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers.startsWith
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.json.JsonMapper
import java.net.URI

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MediaUploadControllerTest(
    @param:Autowired val mvc: MockMvc,
    @param:Autowired val users: UserRepository,
    @param:Autowired val jwt: JwtService,
    @param:Autowired val objectMapper: JsonMapper,
) {
    private fun authCookie(user: User) = Cookie(AuthCookies.NAME, jwt.issue(user))

    private val pngBytes = byteArrayOf(
        0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x00,
    )

    @Test
    fun `로그인 사용자는 이미지를 업로드하고 공개 URL로 조회할 수 있다`() {
        val user = users.saveAndFlush(User(email = "upload@dasida.com", passwordHash = "h", name = "업로더"))

        val upload = mvc.perform(
            multipart("/api/media")
                .file(MockMultipartFile("file", "photo.png", "image/png", pngBytes))
                .cookie(authCookie(user)),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.url").value(startsWith("http://localhost:8080/uploads/")))
            .andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.endsWith(".png")))
            .andReturn()

        val response = objectMapper.readValue(upload.response.contentAsString, MediaUploadResponse::class.java)
        assertThat(response.url).startsWith("http://localhost:8080/uploads/").endsWith(".png")

        mvc.get(URI(response.url).path).andExpect {
            status { isOk() }
            content { contentType(MediaType.IMAGE_PNG) }
        }
    }

    @Test
    fun `비로그인 업로드는 401`() {
        mvc.perform(
            multipart("/api/media")
                .file(MockMultipartFile("file", "photo.png", "image/png", pngBytes)),
        ).andExpect(status().isUnauthorized)
    }

    @Test
    fun `지원하지 않는 형식은 400`() {
        val user = users.saveAndFlush(User(email = "bad-upload@dasida.com", passwordHash = "h", name = "업로더"))
        mvc.perform(
            multipart("/api/media")
                .file(MockMultipartFile("file", "note.txt", "text/plain", "hello".toByteArray()))
                .cookie(authCookie(user)),
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `magic bytes 검증은 확장자와 무관하게 동작한다`() {
        assertThat(MediaUploadService.detectImageExtension(pngBytes)).isEqualTo("png")
        assertThat(MediaUploadService.detectImageExtension(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte()))).isEqualTo("jpg")
        assertThat(MediaUploadService.detectImageExtension("text".toByteArray())).isNull()
    }
}

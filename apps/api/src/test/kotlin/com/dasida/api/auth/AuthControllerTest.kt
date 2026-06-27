package com.dasida.api.auth

import com.dasida.api.security.JwtService
import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthControllerTest(
    @Autowired val mvc: MockMvc,
    @Autowired val repo: UserRepository,
    @Autowired val jwt: JwtService,
    @Autowired val objectMapper: ObjectMapper,
) {

    private fun saveUser(
        email: String = "profile@dasida.com",
        name: String = "기존이름",
        verified: Boolean = false,
        passwordHash: String = "secret-hash",
    ): User = repo.saveAndFlush(
        User(email = email, passwordHash = passwordHash, name = name, verified = verified),
    )

    private fun authorization(user: User) = "Bearer ${jwt.issue(user)}"

    @Test
    fun `회원가입하면 201과 토큰을 반환한다`() {
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"new@dasida.com","password":"password1!","name":"새유저"}"""
        }.andExpect {
            status { isCreated() }
            jsonPath("$.token") { exists() }
            jsonPath("$.name") { value("새유저") }
        }
    }

    @Test
    fun `짧은 비밀번호는 400`() {
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"x@dasida.com","password":"short","name":"엑스"}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `중복 이메일은 409`() {
        val body = """{"email":"dup@dasida.com","password":"password1!","name":"중복"}"""
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = body
        }.andExpect { status { isCreated() } }
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = body
        }.andExpect { status { isConflict() } }
    }

    @Test
    fun `가입 후 로그인하면 토큰을 반환한다`() {
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"login@dasida.com","password":"password1!","name":"로그인"}"""
        }.andExpect { status { isCreated() } }

        mvc.post("/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"login@dasida.com","password":"password1!"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.token") { exists() }
            jsonPath("$.name") { value("로그인") }
        }
    }

    @Test
    fun `이메일은 대소문자 무시 - 대문자로 가입하고 소문자로 로그인된다`() {
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"Case@Dasida.com","password":"password1!","name":"케이스"}"""
        }.andExpect { status { isCreated() } }

        // 다른 케이스로 재가입 시도 → 중복 409
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"CASE@dasida.com","password":"password1!","name":"중복"}"""
        }.andExpect { status { isConflict() } }

        // 다른 케이스로 로그인 → 성공
        mvc.post("/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"case@DASIDA.com","password":"password1!"}"""
        }.andExpect { status { isOk() } }
    }

    @Test
    fun `이메일 형식이 아니면 400`() {
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"not-an-email","password":"password1!","name":"형식"}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `이름은 trim 되어 저장된다`() {
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"trim@dasida.com","password":"password1!","name":"  동원  "}"""
        }.andExpect {
            status { isCreated() }
            jsonPath("$.name") { value("동원") }
        }
    }

    @Test
    fun `공백뿐인 이름은 400`() {
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"blankname@dasida.com","password":"password1!","name":"   "}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `회원가입 이름이 30자를 초과하면 400`() {
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"longname@dasida.com","password":"password1!","name":"${"가".repeat(31)}"}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `비밀번호 정책 - 영문 숫자 특수문자 8에서15자만 통과`() {
        // 통과
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"pwok@dasida.com","password":"password1!","name":"통과"}"""
        }.andExpect { status { isCreated() } }

        // 특수문자 없음 / 숫자 없음 / 영문 없음 / 7자 / 16자 → 모두 400
        val bad = listOf("password1", "password!", "12345678!", "pass1!a", "password123456!!")
        for ((i, pw) in bad.withIndex()) {
            mvc.post("/api/auth/signup") {
                contentType = MediaType.APPLICATION_JSON
                content = """{"email":"bad$i@dasida.com","password":"$pw","name":"불가"}"""
            }.andExpect { status { isBadRequest() } }
        }
    }

    @Test
    fun `깨진 Bearer 토큰으로 me 호출하면 401`() {
        mvc.get("/api/auth/me") {
            headers { add("Authorization", "Bearer broken-token") }
        }.andExpect { status { isUnauthorized() } }
    }

    // ---- 현재 사용자 프로필 ----

    @Test
    fun `비로그인 GET me는 401`() {
        mvc.get("/api/auth/me").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `로그인 GET me는 DB 사용자 프로필을 반환한다`() {
        val user = saveUser(email = "me@dasida.com", name = "현재사용자", verified = true)

        mvc.get("/api/auth/me") { headers { add("Authorization", authorization(user)) } }.andExpect {
            status { isOk() }
            jsonPath("$.id") { value(user.id) }
            jsonPath("$.email") { value("me@dasida.com") }
            jsonPath("$.name") { value("현재사용자") }
            jsonPath("$.verified") { value(true) }
        }
    }

    @Test
    fun `GET me는 오래된 JWT 이름이 아닌 DB 최신 이름을 반환한다`() {
        val user = saveUser(email = "latest@dasida.com", name = "토큰이름")
        val oldToken = jwt.issue(user)
        user.name = "DB최신이름"
        repo.saveAndFlush(user)

        mvc.get("/api/auth/me") { headers { add("Authorization", "Bearer $oldToken") } }.andExpect {
            status { isOk() }
            jsonPath("$.name") { value("DB최신이름") }
        }
    }

    @Test
    fun `토큰 사용자가 DB에 없으면 GET me는 401`() {
        val missingUserToken = jwt.issue(
            User(id = Long.MAX_VALUE, email = "missing@dasida.com", passwordHash = "x", name = "없음"),
        )

        mvc.get("/api/auth/me") {
            headers { add("Authorization", "Bearer $missingUserToken") }
        }.andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `비로그인 PUT me는 401`() {
        mvc.put("/api/auth/me") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"수정"}"""
        }.andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `정상 이름 수정은 trim 후 DB에 저장한다`() {
        val user = saveUser(email = "update@dasida.com")

        mvc.put("/api/auth/me") {
            headers { add("Authorization", authorization(user)) }
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"  새이름  "}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.token") { exists() }
            jsonPath("$.profile.name") { value("새이름") }
        }
        assertThat(repo.findById(requireNotNull(user.id)).get().name).isEqualTo("새이름")
    }

    @Test
    fun `blank 이름 수정은 400`() {
        val user = saveUser(email = "blank-update@dasida.com")
        mvc.put("/api/auth/me") {
            headers { add("Authorization", authorization(user)) }
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"   "}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `30자 초과 이름 수정은 400`() {
        val user = saveUser(email = "long-update@dasida.com")
        mvc.put("/api/auth/me") {
            headers { add("Authorization", authorization(user)) }
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"${"가".repeat(31)}"}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `이름 수정 응답의 새 JWT principal은 수정된 이름이다`() {
        val user = saveUser(email = "jwt-update@dasida.com")
        val response = mvc.put("/api/auth/me") {
            headers { add("Authorization", authorization(user)) }
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"새토큰이름"}"""
        }.andExpect { status { isOk() } }.andReturn().response

        val newToken = objectMapper.readTree(response.contentAsString).get("token").asText()
        assertThat(jwt.parse(newToken).name).isEqualTo("새토큰이름")
    }

    @Test
    fun `이름 수정은 이메일과 verified를 변경하지 않는다`() {
        val user = saveUser(email = "fixed@dasida.com", verified = true)

        mvc.put("/api/auth/me") {
            headers { add("Authorization", authorization(user)) }
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"이름만수정"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.profile.email") { value("fixed@dasida.com") }
            jsonPath("$.profile.verified") { value(true) }
        }

        val saved = repo.findById(requireNotNull(user.id)).get()
        assertThat(saved.email).isEqualTo("fixed@dasida.com")
        assertThat(saved.verified).isTrue()
    }

    @Test
    fun `프로필 응답은 passwordHash를 노출하지 않는다`() {
        val passwordHash = "must-never-be-exposed"
        val user = saveUser(email = "safe@dasida.com", passwordHash = passwordHash)
        val response = mvc.get("/api/auth/me") {
            headers { add("Authorization", authorization(user)) }
        }.andExpect {
            status { isOk() }
            jsonPath("$.passwordHash") { doesNotExist() }
        }.andReturn().response.contentAsString

        assertThat(response).doesNotContain(passwordHash)
    }

    @Test
    fun `같은 이메일 중복 저장은 DB unique 제약으로 막힌다`() {
        // signup race 의 마지막 방어선: 사전 체크를 통과해도 unique 제약이 INSERT 를 막는다(컨트롤러가 409 로 변환).
        repo.saveAndFlush(User(email = "race@dasida.com", passwordHash = "h", name = "원본"))
        assertThrows<DataIntegrityViolationException> {
            repo.saveAndFlush(User(email = "race@dasida.com", passwordHash = "h", name = "중복"))
        }
    }

    @Test
    fun `틀린 비밀번호는 401`() {
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"wrong@dasida.com","password":"password1!","name":"틀림"}"""
        }.andExpect { status { isCreated() } }

        mvc.post("/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"wrong@dasida.com","password":"badpassword"}"""
        }.andExpect { status { isUnauthorized() } }
    }
}

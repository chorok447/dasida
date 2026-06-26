package com.dasida.api.auth

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthControllerTest(@Autowired val mvc: MockMvc) {

    @Test
    fun `회원가입하면 201과 토큰을 반환한다`() {
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"new@dasida.com","password":"password1","name":"새유저"}"""
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
        val body = """{"email":"dup@dasida.com","password":"password1","name":"중복"}"""
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
            content = """{"email":"login@dasida.com","password":"password1","name":"로그인"}"""
        }.andExpect { status { isCreated() } }

        mvc.post("/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"login@dasida.com","password":"password1"}"""
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
            content = """{"email":"Case@Dasida.com","password":"password1","name":"케이스"}"""
        }.andExpect { status { isCreated() } }

        // 다른 케이스로 재가입 시도 → 중복 409
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"CASE@dasida.com","password":"password1","name":"중복"}"""
        }.andExpect { status { isConflict() } }

        // 다른 케이스로 로그인 → 성공
        mvc.post("/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"case@DASIDA.com","password":"password1"}"""
        }.andExpect { status { isOk() } }
    }

    @Test
    fun `이메일 형식이 아니면 400`() {
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"not-an-email","password":"password1","name":"형식"}"""
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `틀린 비밀번호는 401`() {
        mvc.post("/api/auth/signup") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"wrong@dasida.com","password":"password1","name":"틀림"}"""
        }.andExpect { status { isCreated() } }

        mvc.post("/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"email":"wrong@dasida.com","password":"badpassword"}"""
        }.andExpect { status { isUnauthorized() } }
    }
}

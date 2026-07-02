package com.dasida.api.security

import org.junit.jupiter.api.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** in-memory denylist store 와 token hash 동작을 Spring 컨텍스트 없이 검증. */
class TokenDenylistStoreTest {
    private val store = InMemoryTokenDenylistStore()

    @Test
    fun `등록한 토큰 해시는 차단되고 미등록 해시는 통과한다`() {
        val hash = hashToken("some.jwt.token")
        assertFalse(store.isDenied(hash))
        store.deny(hash, 60)
        assertTrue(store.isDenied(hash))
    }

    @Test
    fun `이미 만료된 토큰(ttl 0 이하)은 저장하지 않는다`() {
        val hash = hashToken("expired.jwt.token")
        store.deny(hash, 0)
        assertFalse(store.isDenied(hash))
        store.deny(hash, -5)
        assertFalse(store.isDenied(hash))
    }

    @Test
    fun `TTL 이 지나면 다시 통과한다`() {
        val hash = hashToken("short.jwt.token")
        store.deny(hash, 1)
        assertTrue(store.isDenied(hash))
        Thread.sleep(1100) // 초 단위 TTL 이라 1초+ 대기 후 만료 확인
        assertFalse(store.isDenied(hash))
    }

    @Test
    fun `hashToken 은 원본을 노출하지 않는 64자 hex 다`() {
        val h = hashToken("secret-token")
        assertTrue(h.matches(Regex("[0-9a-f]{64}")))
        assertFalse(h.contains("secret-token"))
    }
}

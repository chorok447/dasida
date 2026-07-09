package com.dasida.api.common

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class ClientRequestInfoTest {
    @Test
    fun `parseClientOs 는 주요 OS 를 구분한다`() {
        assertEquals("Windows", parseClientOs("Mozilla/5.0 (Windows NT 10.0)"))
        assertEquals("macOS", parseClientOs("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)"))
        assertEquals("iOS", parseClientOs("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"))
        assertEquals("Android", parseClientOs("Mozilla/5.0 (Linux; Android 14)"))
    }

    @Test
    fun `parseClientBrowser 는 파생 브라우저를 Chrome 보다 먼저 구분한다`() {
        assertEquals("Edge", parseClientBrowser("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0"))
        assertEquals("Whale", parseClientBrowser("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126.0 Whale/3.25 Safari/537.36"))
        assertEquals("Samsung Internet", parseClientBrowser("Mozilla/5.0 (Linux; Android 14) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36"))
        assertEquals("Chrome", parseClientBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"))
        assertEquals("Safari", parseClientBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15"))
        assertEquals("Firefox", parseClientBrowser("Mozilla/5.0 (Windows NT 10.0; rv:127.0) Gecko/20100101 Firefox/127.0"))
        assertEquals("알 수 없음", parseClientBrowser(null))
        assertEquals("기타", parseClientBrowser("curl/8.6.0"))
    }
}

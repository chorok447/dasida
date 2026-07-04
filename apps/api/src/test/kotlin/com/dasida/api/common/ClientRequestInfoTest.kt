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
}

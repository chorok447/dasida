package com.dasida.api.notification

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@WebMvcTest(NotificationController::class)
class NotificationControllerTest(@Autowired val mvc: MockMvc) {

    @Test
    fun `목록은 시드 전체를 반환한다`() {
        mvc.get("/api/notifications").andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(NotificationSeed.notifications.size) }
            jsonPath("$[0].id") { value("n1") }
        }
    }
}

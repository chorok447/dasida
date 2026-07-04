package com.dasida.api.common

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class RichBodyHtmlTest {
    @Test
    fun `splitRichBodyHtml 은 img 를 본문과 갤러리로 분리한다`() {
        val (html, images) = splitRichBodyHtml(
            """<p>소개</p><p><img src="https://a.com/1.jpg" alt="" /></p>""",
        )
        assertEquals("""<p>소개</p>""", html)
        assertEquals(listOf("https://a.com/1.jpg"), images)
    }

    @Test
    fun `cleanEmptyRichParagraphs 는 빈 p 를 제거한다`() {
        assertEquals(
            """<p>본문</p>""",
            cleanEmptyRichParagraphs("""<p>본문</p><p></p><p>&nbsp;</p>"""),
        )
    }
}

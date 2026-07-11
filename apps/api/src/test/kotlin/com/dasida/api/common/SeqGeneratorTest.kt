package com.dasida.api.common

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * SeqGenerator 는 게시글·게시글댓글·캠페인·메시지·알림의 정렬 키를 만든다. 같은 밀리초에 몰린
 * 생성도 강한 단조 증가로 순서를 보존해야 정렬(seq DESC) 의 tiebreaker 가 랜덤 id 로 흐트러지지 않는다.
 */
class SeqGeneratorTest {
    @Test
    fun `연속 호출은 같은 밀리초 안에서도 강한 단조 증가를 보장한다`() {
        // 타이트 루프라 다수 호출이 같은 currentTimeMillis 를 공유하며 +1 단조 경로를 태운다.
        val seqs = (0 until 10_000).map { SeqGenerator.next() }
        seqs.zipWithNext().forEach { (a, b) -> assertThat(b).isGreaterThan(a) }
    }

    @Test
    fun `seq 는 epoch 밀리초를 나노 스케일로 올린 값이라 항상 현재 시각 이상이다`() {
        val floor = System.currentTimeMillis() * 1_000_000L
        assertThat(SeqGenerator.next()).isGreaterThanOrEqualTo(floor)
    }
}

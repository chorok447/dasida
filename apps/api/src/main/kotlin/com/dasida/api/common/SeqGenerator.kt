package com.dasida.api.common

import java.util.concurrent.atomic.AtomicLong

/**
 * 메시지·알림 정렬 키(seq) 생성기. 이전의 System.nanoTime() 은 기원이 JVM/OS 부팅 시점이라
 * 재시작하면 새 값이 과거보다 작아지고(새 메시지가 옛 메시지 앞으로 정렬), 다중 인스턴스
 * (app.dm.ws.fanout=redis) 간에는 서로 비교가 불가능했다.
 *
 * epoch 밀리초를 나노 스케일로 올려 사용한다: 프로세스와 무관하게 전진하고, 기존에 저장된
 * nanoTime 값(가동시간 기반 — 현실적으로 훨씬 작음)보다 항상 커서 기존 데이터 뒤에 정렬된다.
 * 같은 밀리초 내 호출은 인스턴스 내 단조 증가로 순서를 보존한다(2262년까지 Long 범위 내).
 */
object SeqGenerator {
    private val last = AtomicLong(0)

    fun next(): Long = last.updateAndGet { prev -> maxOf(prev + 1, System.currentTimeMillis() * 1_000_000L) }
}

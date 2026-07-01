package com.dasida.api.common

/**
 * page/size 요청 파라미터 공통 검증.
 *
 * 여러 도메인 서비스가 `page >= 0`, `1 <= size <= maxSize` 라는 동일한 정책과 동일한 에러 메시지를
 * 반복해서 사용한다. 정책이 완전히 같으므로 한 곳에서 처리하되, 도메인마다 다른 상한값(maxSize)은
 * 인자로 받는다(검색 50, 댓글/알림/신고/참가자 목록 등 100). 던지는 status(400)와 message 문구는
 * 기존 각 서비스의 것과 글자 단위로 동일하다.
 */
fun checkPageParams(page: Int, size: Int, maxSize: Int) {
    if (page < 0) badRequest("page must not be negative")
    checkPageSize(size, maxSize)
}

/**
 * size 만 검증하는 케이스(댓글 딥링크 위치 조회처럼 page 를 받지 않는 경로)를 위한 helper.
 */
fun checkPageSize(size: Int, maxSize: Int) {
    if (size !in 1..maxSize) badRequest("size must be between 1 and $maxSize")
}

package com.dasida.api.common

import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException

/**
 * 도메인 서비스가 공유하는 HTTP 에러 helper.
 *
 * 기존과 동일하게 [ResponseStatusException] 을 던진다. status code 와 message 는 호출부가 정하며,
 * ControllerAdvice/ProblemDetail 같은 전역 에러 포맷 변경은 하지 않는다. `Nothing` 을 반환하므로
 * Kotlin 의 흐름 분석에서 이후 코드가 도달 불가로 처리된다(elvis 우변 등에 그대로 쓸 수 있다).
 */
fun badRequest(message: String): Nothing =
    throw ResponseStatusException(HttpStatus.BAD_REQUEST, message)

fun unauthorized(message: String = "Unauthorized"): Nothing =
    throw ResponseStatusException(HttpStatus.UNAUTHORIZED, message)

fun forbidden(message: String): Nothing =
    throw ResponseStatusException(HttpStatus.FORBIDDEN, message)

fun notFound(message: String): Nothing =
    throw ResponseStatusException(HttpStatus.NOT_FOUND, message)

fun conflict(message: String): Nothing =
    throw ResponseStatusException(HttpStatus.CONFLICT, message)

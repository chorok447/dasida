package com.dasida.api.common

const val QUERYDSL_LIKE_ESCAPE = '!'

private fun likeEscaped(value: String): String = value.lowercase()
    .replace(QUERYDSL_LIKE_ESCAPE.toString(), "$QUERYDSL_LIKE_ESCAPE$QUERYDSL_LIKE_ESCAPE")
    .replace("%", "$QUERYDSL_LIKE_ESCAPE%")
    .replace("_", "${QUERYDSL_LIKE_ESCAPE}_")

fun literalContainsPattern(value: String): String = "%${likeEscaped(value)}%"

/** JSON 배열 컬럼의 직렬화 문자열에서 따옴표로 감싼 원소 완전 일치 패턴("[\"a\",\"b\"]" 형태 전제). */
fun literalJsonElementPattern(value: String): String = "%\"${likeEscaped(value)}\"%"

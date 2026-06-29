package com.dasida.api.common

const val QUERYDSL_LIKE_ESCAPE = '!'

fun literalContainsPattern(value: String): String = "%${value.lowercase()
    .replace(QUERYDSL_LIKE_ESCAPE.toString(), "$QUERYDSL_LIKE_ESCAPE$QUERYDSL_LIKE_ESCAPE")
    .replace("%", "$QUERYDSL_LIKE_ESCAPE%")
    .replace("_", "${QUERYDSL_LIKE_ESCAPE}_")}%"

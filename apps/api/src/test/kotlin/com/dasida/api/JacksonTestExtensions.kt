package com.dasida.api

import tools.jackson.databind.JsonNode

/** Jackson 3 JsonNode 배열은 Iterable map/first 확장이 없어 테스트에서 공통 순회 helper 로 사용한다. */
fun JsonNode.toElementList(): List<JsonNode> = (0 until size()).map { get(it)!! }

fun JsonNode.mapElements(transform: (JsonNode) -> String): List<String> =
    toElementList().map(transform)

package com.dasida.api.common.geo

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import tools.jackson.databind.json.JsonMapper
import java.net.InetAddress
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap

data class GeoLocation(val country: String, val region: String?)

/**
 * IP 기반의 대략적인 위치(국가·지역) 조회. 접속 기록 표시용으로만 쓰는 베스트에포트 정보라
 * 실패·미상은 null 을 반환하고 호출부는 그대로 비워 둔다.
 *
 * - 사설/루프백 IP(로컬 개발·내부망)는 조회하지 않는다.
 * - 외부 조회는 ip-api.com 무료 엔드포인트(키 불요, 분당 45회)를 짧은 타임아웃으로 호출한다.
 *   접속 기록은 로그인 시점에만 쌓여 호출량이 낮고, 결과는 IP 별로 캐시한다(실패도 부정 캐시).
 * - `app.geoip.enabled=false` 로 끌 수 있다(테스트 기본).
 */
@Service
class GeoIpService(
    @param:Value("\${app.geoip.enabled:true}") private val enabled: Boolean,
    @param:Value("\${app.geoip.endpoint:http://ip-api.com/json}") private val endpoint: String,
    private val mapper: JsonMapper,
) {
    private val http: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofMillis(1_500))
        .build()

    // 값이 null 인 캐시 항목(조회 실패/미상)도 저장해 같은 IP 재조회를 막는다.
    private val cache = ConcurrentHashMap<String, GeoLocation?>()

    fun lookup(ip: String): GeoLocation? {
        if (!enabled || !isLookupable(ip)) return null
        if (cache.size > MAX_CACHE_ENTRIES) cache.clear()
        return cache.computeIfAbsent(ip) { fetch(it) }
    }

    private fun fetch(ip: String): GeoLocation? = try {
        val request = HttpRequest.newBuilder()
            .uri(URI.create("$endpoint/$ip?fields=status,country,regionName&lang=ko"))
            .timeout(Duration.ofMillis(1_500))
            .GET()
            .build()
        val response = http.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() != 200) {
            null
        } else {
            val node = mapper.readTree(response.body())
            val country = node.path("country").asString("")
            val region = node.path("regionName").asString("")
            if (node.path("status").asString("") != "success" || country.isBlank()) {
                null
            } else {
                GeoLocation(country.take(64), region.take(64).ifBlank { null })
            }
        }
    } catch (ex: Exception) {
        log.debug("geoip lookup failed for {}: {}", ip, ex.message)
        null
    }

    /** 공인 IP 리터럴만 조회 대상. 호스트명 형태는 DNS 조회를 피하기 위해 즉시 제외한다. */
    private fun isLookupable(ip: String): Boolean {
        if (!ip.matches(IP_LITERAL)) return false
        return try {
            val addr = InetAddress.getByName(ip)
            !(addr.isLoopbackAddress || addr.isSiteLocalAddress || addr.isLinkLocalAddress || addr.isAnyLocalAddress)
        } catch (_: Exception) {
            false
        }
    }

    private companion object {
        val log = LoggerFactory.getLogger(GeoIpService::class.java)
        val IP_LITERAL = Regex("^[0-9a-fA-F:.]+$")
        const val MAX_CACHE_ENTRIES = 10_000
    }
}

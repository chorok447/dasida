package com.dasida.api.security

import jakarta.servlet.DispatcherType
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.HttpStatusEntryPoint
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
@EnableWebSecurity
class SecurityConfig(
    private val jwtFilter: JwtAuthFilter,
    @Value("\${app.web-origin}") private val webOrigin: String,
) {
    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    // ponytail: 단일 origin 만 허용(신뢰 경계). WebConfig 의 MVC CORS 를 대체.
    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val cfg = CorsConfiguration().apply {
            allowedOrigins = listOf(webOrigin)
            allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
            allowedHeaders = listOf("*")
        }
        return UrlBasedCorsConfigurationSource().apply { registerCorsConfiguration("/api/**", cfg) }
    }

    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .cors { }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .exceptionHandling { it.authenticationEntryPoint(HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)) }
            .authorizeHttpRequests {
                // ERROR 재디스패치는 인가에서 제외 → 컨트롤러가 던진 400/409 등이 /error 경유로
                // 401 마스킹되는 것을 막는다. 클라이언트가 직접 친 /error 는 REQUEST 디스패치라
                // 아래 anyRequest().authenticated() 에 걸려 401 로 차단된다.
                it.dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                it.requestMatchers("/actuator/health").permitAll()
                it.requestMatchers(HttpMethod.POST, "/api/auth/**").permitAll()
                it.requestMatchers(HttpMethod.GET, "/api/posts/mine").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/posts/bookmarks").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/campaigns/joined").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/campaigns/mine").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/campaigns/*/participants").authenticated()
                // 알림은 사용자별 데이터 → 일반 GET permitAll 보다 먼저 보호한다.
                it.requestMatchers(HttpMethod.GET, "/api/notifications/**").authenticated()
                it.requestMatchers(HttpMethod.POST, "/api/notifications/**").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/**").permitAll()
                it.anyRequest().authenticated()
            }
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter::class.java)
        return http.build()
    }
}

package com.dasida.api.security

import jakarta.servlet.DispatcherType
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

@Configuration
@EnableWebSecurity
class SecurityConfig(
    private val jwtFilter: JwtAuthFilter,
) {
    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    // CORS 정책은 CorsConfig 로 분리했다. .cors{} 가 corsConfigurationSource bean 을 자동으로 사용한다.

    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        http
            // CSRF 토큰 미사용: 인증 쿠키가 SameSite=Lax(AuthCookies)라 cross-site POST 에 실리지 않고,
            // CORS origin 허용 목록으로 브라우저 교차 출처 요청을 제한한다.
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
                // OpenAPI JSON / Swagger UI 는 문서 확인용으로 공개한다. /api/** 인증 정책과 무관한 별도 경로다.
                it.requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                it.requestMatchers(HttpMethod.POST, "/api/auth/**").permitAll()
                it.requestMatchers(HttpMethod.GET, "/api/posts/mine").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/posts/mine/page").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/posts/bookmarks").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/posts/bookmarks/page").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/auth/access-logs").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/campaigns/joined").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/campaigns/joined/page").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/campaigns/mine").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/campaigns/mine/page").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/campaigns/*/participants").authenticated()
                // 알림은 사용자별 데이터 → 일반 GET permitAll 보다 먼저 보호한다.
                it.requestMatchers(HttpMethod.GET, "/api/users/recommended").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/users/me/following", "/api/users/me/followers").authenticated()
                it.requestMatchers(HttpMethod.POST, "/api/users/*/follow").authenticated()
                it.requestMatchers(HttpMethod.DELETE, "/api/users/*/follow").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/users/*/follow").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/notifications/**").authenticated()
                it.requestMatchers(HttpMethod.POST, "/api/notifications/**").authenticated()
                it.requestMatchers(HttpMethod.GET, "/api/reports/mine").authenticated()
                it.requestMatchers(HttpMethod.POST, "/api/reports").authenticated()
                it.requestMatchers(HttpMethod.POST, "/api/media").authenticated()
                it.requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()
                it.requestMatchers(HttpMethod.GET, "/api/**").permitAll()
                it.anyRequest().authenticated()
            }
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter::class.java)
        return http.build()
    }
}

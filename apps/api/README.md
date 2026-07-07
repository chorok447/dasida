# Dasida API

다시,다(Dasida) 백엔드 API 서버 (Kotlin + Spring Boot 4.1).

![Kotlin](https://img.shields.io/badge/Kotlin-2.3.21-7F52FF?logo=kotlin&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1-6DB33F?logo=springboot&logoColor=white)
![JDK](https://img.shields.io/badge/JDK-21-437291?logo=openjdk&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-jjwt%200.13.0-black?logo=jsonwebtokens)
![Valkey](https://img.shields.io/badge/Valkey-8_(compose%20local)-DC382D?logo=redis&logoColor=white)

## 실행

```bash
# 저장소 루트에서
pnpm dev:api          # gradlew bootRun
# 또는 apps/api 에서
./gradlew bootRun
```

기본 포트는 `8080` 이다.

## 운영(prod) 보안 설정 요약

운영 환경에서 위험한 기본값/누락 설정이 들어가지 않도록 다음 정책을 코드/설정으로 고정하고 회귀 테스트로 보장한다.

| 항목 | local/dev/test | prod | 강제 지점 |
|---|---|---|---|
| OpenAPI/Swagger | 사용 가능 | 비활성화(`/v3/api-docs`·`/swagger-ui` 404) | `application-prod.yml` springdoc disabled |
| CORS origin | localhost/127.0.0.1 허용 | `APP_CORS_ALLOWED_ORIGINS` 명시 필수, `*`·localhost 금지 | `CorsProperties.assertProdSafe()` (미충족 시 기동 실패) |
| Actuator | health-only, details 미노출 | 동일 | `management.*` 설정 + SecurityConfig |
| JWT secret | dev 기본값 허용 | `dev-insecure` 기본값이면 기동 실패 | `JwtService` init guard |

JWT secret(`JWT_SECRET`), DB 접속 정보, CORS origin 등 민감 설정은 운영에서 **환경변수/secret manager 로 주입**해야 하며 저장소에 커밋하지 않는다. 기본값(`dev-insecure...`)으로 prod 를 기동하면 `JwtService` 가 이를 거부한다.

관련 회귀 테스트: `OpenApiProdProfileTest`, `CorsPropertiesTest`, `CorsProdProfileTest`, `CorsConfigProdGuardTest`, `ActuatorProdProfileTest`, `ActuatorSecurityTest`, `JwtServiceTest`.

## API 문서 (OpenAPI / Swagger)

API 명세는 `springdoc-openapi` 로 코드에서 자동 생성된다. Controller/DTO 를 그대로 반영하므로 별도 수기 문서와 어긋나지 않는다.

로컬 서버 실행 후 다음 경로에서 확인한다.

- Swagger UI: http://localhost:8080/swagger-ui/index.html
- OpenAPI JSON: http://localhost:8080/v3/api-docs

### OpenAPI 문서 노출 정책

- **local/dev/test**: `/swagger-ui/index.html`, `/v3/api-docs` 사용 가능.
- **prod**: `application-prod.yml` 에서 springdoc `api-docs.enabled=false`, `swagger-ui.enabled=false` 로 문서 endpoint 를 비활성화한다. 해당 경로는 핸들러가 없어 404 가 되고, 문서 내용이 외부에 노출되지 않는다.

운영 환경에서 문서를 노출해야 하는 경우, 별도 인증/네트워크 제한 정책을 추가한 뒤 활성화해야 한다.

### 인증 사용법

인증이 필요한 API 는 문서에서 자물쇠 아이콘(`bearerAuth`)으로 표시된다.

1. `POST /api/auth/signup` 또는 `POST /api/auth/login` 으로 JWT 를 발급받는다.
2. Swagger UI 의 **Authorize** 버튼을 눌러 발급받은 토큰을 입력한다. (`Bearer` 접두사는 UI 가 자동으로 붙인다.)
3. 이후 인증 필수 API 를 호출한다.

### public API 와 bearerAuth API

- **public**: 대부분의 `GET` 목록/상세/검색 API. JWT 가 있으면 응답에 사용자별 상태(`likedByMe`, `joinedByMe`, `ownedByMe` 등)가 채워진다.
- **bearerAuth**: 작성/수정/삭제, 좋아요/북마크/참여, 알림, 신고, 마이페이지(`/mine`, `/bookmarks`, `/joined`), 참가자 관리 등 사용자별 데이터/행위 API.

### 로그아웃과 토큰 무효화(denylist)

stateless JWT 라 **refresh token 은 없고** access token 하나만 사용한다. 로그아웃은 서버가 해당 access token 을 만료 전까지 denylist 에 올려 재사용을 차단한다.

- **`POST /api/auth/logout`** (bearerAuth): 현재 `Authorization: Bearer <access token>` 을 denylist 에 등록한다.
  - 성공: `200 { "loggedOut": true }`
  - 토큰 없음 / 깨진 토큰 / 이미 로그아웃(denylisted)된 토큰: `401`
  - 로그아웃 후 **같은 access token** 으로 인증 API 호출 시 `401`
- **refresh token 은 없다.** 토큰 재발급은 재로그인으로 한다(`updateProfile`/`changePassword`/`changeEmail` 은 응답에 새 토큰을 함께 반환).
- 프론트엔드는 `localStorage` 토큰 삭제와 함께 이 `logout` API 를 호출할 수 있다(프론트 코드는 이 문서 범위 밖).

**denylist 동작(요약)**:

- 원본 JWT 는 저장하지 않고 **SHA-256 hash** 만 저장한다.
- Redis key: `denylist:jwt:access:sha256:{tokenHash}`, value 는 placeholder, TTL = access token 남은 만료 시간(자동 소멸).
- store 는 rate limit 과 동일 패턴: 기본/test 는 in-memory, compose local 은 Redis/Valkey. **prod Redis store 적용은 아직 TODO**.
- Redis 장애 시 denylist 는 **fail-closed**(인증 거절)로 동작한다.

상세: [logout/denylist 설계](docs/backend/auth-token-revocation.md), [Redis 보안 store 운영 정책](docs/backend/redis-security-store-policy.md).

### CORS 설정

CORS 는 `app.cors.*`(`CorsProperties`)로 관리하며 `/api/**` 에 적용된다.

- **local/dev/test**: `http://localhost:3000`, `http://127.0.0.1:3000` 허용(기본값).
- **prod**: `application-prod.yml` 에서 `app.cors.allowed-origins: ${APP_CORS_ALLOWED_ORIGINS:}` 로 주입한다. 미설정/`*`/localhost 면 `CorsProperties.assertProdSafe()` 가 기동을 실패시킨다.

```bash
# comma-separated 로 복수 origin 지정 가능
APP_CORS_ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
```

`Authorization`/`Content-Type` 헤더와 credentials 를 허용하지만, CORS 허용은 인증 우회가 아니다. 인증 필수 API 는 여전히 JWT Bearer 토큰이 필요하다(예: `GET /api/auth/me` 는 토큰 없으면 401).

`UserProfileResponse.profileImageUrl` / `UpdateProfileRequest.profileImageUrl`(선택)은 http 또는 https URL만 허용하며 최대 500자이다. null/blank 는 이미지 없음이며, 댓글·게시글 `Author` snapshot 에 저장되어 목록에 표시된다.

### Rate limit

특정 mutation endpoint 에 IP 기준 **fixed-window** rate limit 을 적용한다. 글로벌 API rate limit 은 없으며, 아래 endpoint 만 대상이다.

#### 적용 endpoint

| Endpoint | limit / window | Redis key prefix (`{clientIp}` = 클라이언트 IP) |
|----------|----------------|------------------------------------------------|
| `POST /api/auth/login` | 20 / 60초 | `rate-limit:auth:login:ip:{clientIp}` |
| `POST /api/auth/signup` | 10 / 60초 | `rate-limit:auth:signup:ip:{clientIp}` |
| `POST /api/posts/{id}/comments` | 20 / 60초 (게시글·캠페인 댓글 작성 공유 버킷) | `rate-limit:comment:create:ip:{clientIp}` |
| `POST /api/campaigns/{id}/comments` | 20 / 60초 (게시글·캠페인 댓글 작성 공유 버킷) | `rate-limit:comment:create:ip:{clientIp}` |
| `POST /api/reports` | 10 / 60초 | `rate-limit:report:create:ip:{clientIp}` |

- **기준**: 클라이언트 IP. `X-Forwarded-For` 가 있으면 첫 hop 을 사용하고, 없으면 `remoteAddr` 를 사용한다.
- **알고리즘**: fixed-window. window 는 `app.rate-limit.*.window-seconds`(기본 60초)로 설정한다.
- **미적용**: 위 목록 외 endpoint(조회·수정·삭제·기타 mutation)에는 rate limit 이 없다.

#### 초과 응답

한도 초과 시 servlet filter 가 요청을 차단한다.

- **status**: `429 Too Many Requests`
- **header**: `Retry-After` (남은 window 초, 초 단위)
- **body**: Spring 기본 `/error` JSON (`status`, `error`, `path` 등). stacktrace·내부 reason 은 노출하지 않는다.

#### store (in-memory vs Redis-compatible)

| 환경 | `app.rate-limit.store` | 비고 |
|------|------------------------|------|
| 기본(`application.properties`) | `memory` | 호스트에서 `bootRun` 시 in-memory 버킷 |
| 테스트(`src/test/resources/application.properties`) | `memory` | CI·단위 테스트. auth/content limit 은 높게 설정해 기존 테스트 간섭을 줄인다 |
| compose local(`application-local.properties`, `SPRING_PROFILES_ACTIVE=local`) | `redis` | `compose.local.yml` 의 Valkey(`redis` 서비스, `valkey/valkey:8`)에 연결 |

compose local 스택(`docker compose -f compose.local.yml up`)은 MySQL·API·Web 과 함께 Valkey 를 기동한다. API 컨테이너는 `SPRING_DATA_REDIS_HOST=redis`, `SPRING_DATA_REDIS_PORT=6379` 로 연결하며, rate limit 버킷만 Redis-compatible store 를 사용한다(캐싱·세션·JWT 정책 변경 없음).

Redis 연결 smoke test(선택): compose 기동 후 `REDIS_SMOKE=true ./gradlew test --tests RedisCompatibleStoreConnectionTest`

DM WS Redis fan-out smoke(선택): `REDIS_SMOKE=true ./gradlew test --tests DmWsFanoutRedisTest`

#### 설정 property

`app.rate-limit.*` (`RateLimitProperties`)로 제어한다. 환경변수 바인딩은 Spring Boot relaxed binding(`APP_RATE_LIMIT_*`)을 따른다.

| property | 기본값 | 설명 |
|----------|--------|------|
| `app.rate-limit.enabled` | `true` | `false` 이면 rate limit 을 적용하지 않는다 |
| `app.rate-limit.store` | `memory` | `memory` 또는 `redis` |
| `app.rate-limit.auth.login.limit` | `20` | 로그인 limit |
| `app.rate-limit.auth.login.window-seconds` | `60` | 로그인 window(초) |
| `app.rate-limit.auth.signup.limit` | `10` | 회원가입 limit |
| `app.rate-limit.auth.signup.window-seconds` | `60` | 회원가입 window(초) |
| `app.rate-limit.content.comment.limit` | `20` | 댓글 작성 limit |
| `app.rate-limit.content.comment.window-seconds` | `60` | 댓글 작성 window(초) |
| `app.rate-limit.content.report.limit` | `10` | 신고 생성 limit |
| `app.rate-limit.content.report.window-seconds` | `60` | 신고 생성 window(초) |

관련 회귀 테스트: `AuthRateLimitTest`, `ContentWriteRateLimitTest`, `RateLimitServiceTest`.

### Actuator 노출 정책

외부에 공개되는 Actuator endpoint 는 헬스체크용 `/actuator/health` 로 제한한다.

- 공개: `/actuator/health` (SecurityConfig 에서 이 경로만 permitAll)
- 비공개/미노출: `/actuator/env`, `/actuator/beans`, `/actuator/configprops`, `/actuator/mappings` 등 (`management.endpoints.web.exposure.include=health`)
- `health` 응답에 `details`/`components` 미노출 (`management.endpoint.health.show-details=never`)

로드밸런서/배포 헬스체크는 `/actuator/health` 를 사용한다. liveness/readiness probe 는 현재 미사용이며 배포 환경 확정 후 별도 PR 에서 검토한다.

### 에러 응답

기존 응답 포맷을 그대로 사용한다. 주요 status code:

- `400` 잘못된 요청 (검증 실패 등)
- `401` 인증 필요 또는 유효하지 않은 토큰
- `403` 권한 없음 (소유자/개설자 아님 등)
- `404` 리소스 없음
- `409` 상태 충돌 또는 중복 (모집 상태 전이, 중복 참여/신고 등)
- `429` rate limit 초과 (`Retry-After` 헤더 포함)

응답 body 는 Spring 기본 동작을 그대로 사용한다(별도 전역 에러 포맷은 도입하지 않음).

- `400`/`403`/`404`/`409` 등 `ResponseStatusException` 계열은 기본 `/error` 로 처리되어 `status` 를 담은 JSON 을 반환하고, stacktrace·예외 클래스·내부 reason 메시지는 노출하지 않는다.
- 미인증 `401` 은 `HttpStatusEntryPoint` 로 status 전용 응답이라 에러 본문을 만들지 않는다.

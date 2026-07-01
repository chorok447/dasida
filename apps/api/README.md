# Dasida API

다시,다(Dasida) 백엔드 API 서버 (Kotlin + Spring Boot 3.5).

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

### CORS 설정

CORS 는 `app.cors.*`(`CorsProperties`)로 관리하며 `/api/**` 에 적용된다.

- **local/dev/test**: `http://localhost:3000`, `http://127.0.0.1:3000` 허용(기본값).
- **prod**: `application-prod.yml` 에서 `app.cors.allowed-origins: ${APP_CORS_ALLOWED_ORIGINS:}` 로 주입한다. 미설정/`*`/localhost 면 `CorsProperties.assertProdSafe()` 가 기동을 실패시킨다.

```bash
# comma-separated 로 복수 origin 지정 가능
APP_CORS_ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
```

`Authorization`/`Content-Type` 헤더와 credentials 를 허용하지만, CORS 허용은 인증 우회가 아니다. 인증 필수 API 는 여전히 JWT Bearer 토큰이 필요하다(예: `GET /api/auth/me` 는 토큰 없으면 401).

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

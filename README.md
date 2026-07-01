# 다시,다 (Dasida)

한국형 업사이클링 / 소셜 캠페인 앱. pnpm + Gradle 모노레포.

## 구조

```
apps/web   # Next.js (App Router) + TypeScript + Tailwind v4 프론트엔드
apps/api   # Kotlin + Spring Boot 3.5 백엔드 (JWT 인증, MySQL/JPA)
packages/  # 공유 TS 패키지 (필요 시)
design-reference/  # Figma Make 익스포트(디자인 참고용, 실행 대상 아님)
```

- **프론트엔드**: `apps/web` — Next.js, 토큰은 `localStorage` 기반.
- **백엔드**: `apps/api` — Kotlin/Spring Boot, JWT(jjwt) + Spring Security(stateless), MySQL 8(JPA/Hibernate). 테스트는 H2 인메모리(MySQL 모드)라 Docker 불필요.

## 로컬 실행

### 1. 의존성 설치

```bash
pnpm install        # JS 워크스페이스(web + packages). apps/api 는 Gradle 전용.
```

### 2. DB 실행 (백엔드용)

```bash
docker compose up -d   # 루트 docker-compose.yml 의 MySQL 8
```

### 3. 개발 서버

```bash
pnpm dev:web        # Next.js dev (http://localhost:3000)
pnpm dev:api        # Spring Boot (http://localhost:8080)
```

## 환경 변수

| 변수 | 대상 | 설명 |
|------|------|------|
| `JWT_SECRET` | api | JWT 서명 시크릿(최소 32바이트). prod 에서는 필수 — 미설정 시 기동 실패. |
| `JWT_TTL_MS` | api | 토큰 만료(ms). 기본 86400000(24h). |
| `DB_URL` / `DB_USER` / `DB_PASSWORD` | api | MySQL 접속 정보. 기본은 docker-compose 값. |
| `APP_CORS_ALLOWED_ORIGINS` | api | **prod 필수.** 허용할 프론트 origin(comma-separated). prod 에서 미설정/`*`/localhost 면 기동 실패. |
| `NEXT_PUBLIC_API_URL` | web | 백엔드 베이스 URL. 기본 `http://localhost:8080`. |

## 빌드

```bash
pnpm build:web      # Next.js 프로덕션 빌드
pnpm build:api      # gradlew build
```

## 테스트 / 검증

```bash
# 프론트
pnpm --filter web lint
pnpm --filter web build

# 백엔드
cd apps/api
./gradlew test --no-daemon
./gradlew build --no-daemon
```

## API 문서 (OpenAPI / Swagger)

백엔드 API 명세는 `springdoc-openapi` 로 코드에서 자동 생성된다. `pnpm dev:api` 실행 후 확인한다.

- Swagger UI: http://localhost:8080/swagger-ui/index.html
- OpenAPI JSON: http://localhost:8080/v3/api-docs

인증 필수 API 는 문서에서 `bearerAuth` 자물쇠로 표시되며, Swagger UI 의 **Authorize** 에 로그인/회원가입으로 받은 JWT 를 입력해 호출한다. 자세한 내용은 [`apps/api/README.md`](apps/api/README.md) 참고.

> 노출 정책: local/dev/test 에서는 문서가 열려 있고, **`prod` 프로파일에서는 springdoc(api-docs·swagger-ui)을 비활성화**해 외부에 노출되지 않는다.

## CORS 설정

CORS 는 `app.cors.*` property(`CorsProperties`)로 관리하며 `/api/**` 에 적용된다.

로컬 개발 환경에서는 Next.js 개발 서버를 위해 다음 origin 을 허용한다.

- `http://localhost:3000`
- `http://127.0.0.1:3000`

운영 환경(`prod`)에서는 `APP_CORS_ALLOWED_ORIGINS` 를 반드시 명시해야 하며, `*`(wildcard)와 localhost 는 허용하지 않는다(미설정/위반 시 기동 실패).

```bash
APP_CORS_ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
```

프론트는 JWT 를 `Authorization` 헤더로 보내므로 `Authorization`/`Content-Type` 헤더와 credentials 를 허용한다. CORS 허용은 브라우저 origin 정책일 뿐 **인증을 우회하지 않는다** — 인증이 필요한 API 는 여전히 JWT Bearer 토큰이 필요하다.

## 헬스 체크 / Actuator 노출 정책

외부에 공개되는 Actuator endpoint 는 헬스체크용 `/actuator/health` 로 제한한다. 로드밸런서/배포 헬스체크는 이 경로를 사용한다.

- 공개: `GET /actuator/health` (SecurityConfig 에서 이 경로만 permitAll)
- 미노출: `/actuator/env`, `/actuator/beans`, `/actuator/configprops`, `/actuator/mappings`, `/actuator/metrics`, `/actuator/loggers` 등 (web exposure 를 `health` 로만 제한)
- `health` 응답에 `details`/`components` 는 노출하지 않는다 (`management.endpoint.health.show-details=never`).

liveness/readiness probe 는 현재 사용하지 않으며, 배포 환경이 확정된 뒤 별도 PR 에서 검토한다.

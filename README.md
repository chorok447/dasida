# 다시,다 (Dasida)

한국형 업사이클링 / 소셜 캠페인 앱. pnpm + Gradle 모노레포.

## 기술 스택

### Frontend

![Next.js](https://img.shields.io/badge/Next.js-16.2.9-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19.2.7-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![motion](https://img.shields.io/badge/motion-12.42.2-663399?style=for-the-badge)

### Backend

![Kotlin](https://img.shields.io/badge/Kotlin-2.4.0-7F52FF?style=for-the-badge&logo=kotlin&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-4.1.0-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)
![Java](https://img.shields.io/badge/Java-21-437291?style=for-the-badge&logo=openjdk&logoColor=white)
![QueryDSL](https://img.shields.io/badge/QueryDSL-7.4.0-4479A1?style=for-the-badge)
![JJWT](https://img.shields.io/badge/JJWT-0.13.0-black?style=for-the-badge&logo=jsonwebtokens)
![Jackson](https://img.shields.io/badge/Jackson-3-232323?style=for-the-badge)
![Spring Security](https://img.shields.io/badge/Spring_Security-6DB33F?style=for-the-badge&logo=springsecurity&logoColor=white)
![JPA / Hibernate](https://img.shields.io/badge/JPA_%2F_Hibernate-59666C?style=for-the-badge&logo=hibernate&logoColor=white)

### Infra and Database

![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Valkey](https://img.shields.io/badge/Valkey-8-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![H2](https://img.shields.io/badge/H2-0949BA?style=for-the-badge)
![Gradle](https://img.shields.io/badge/Gradle-8.14.5-02303A?style=for-the-badge&logo=gradle&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11.9.0-F69220?style=for-the-badge&logo=pnpm&logoColor=white)

## 구조

```
apps/web   # Next.js (App Router) + TypeScript + Tailwind v4 프론트엔드
apps/api   # Kotlin + Spring Boot 4.1 백엔드 (JWT 인증, MySQL/JPA)
packages/  # 공유 TS 패키지 (필요 시)
design-reference/  # Figma Make 익스포트(디자인 참고용, 실행 대상 아님)
```

- **프론트엔드**: `apps/web` — Next.js, 인증은 httpOnly 쿠키 기반(JWT 를 JS 에서 접근 불가).
- **백엔드**: `apps/api` — Kotlin/Spring Boot 4.1, JWT(jjwt) + Spring Security(stateless), MySQL 8(JPA/Hibernate). 테스트는 H2 인메모리(MySQL 모드)라 Docker 불필요.

## 로컬 실행

### Docker Compose (MySQL + Redis-compatible store + API + Web 한 번에)

로컬 개발용으로 MySQL, Redis-compatible store(Valkey), Spring Boot API, Next.js Web 을 컨테이너로 빌드·실행한다. **운영 배포용이 아니다.**

```bash
docker compose -f compose.local.yml up --build
```

| 서비스 | URL |
|--------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui/index.html |
| MySQL | `localhost:3306` (DB `dasida`, user `dasida`) |
| Redis-compatible store | `localhost:6379` (compose 서비스명 `redis`, 이미지 `valkey/valkey`) |

- API 는 `local` 프로파일로 Valkey(`redis` 호스트)에 연결한다. 캐싱·세션·JWT 정책은 변경하지 않는다.
- rate limit 버킷 store 로 Valkey 를 사용한다(`app.rate-limit.store=redis`). 정책 상세는 아래 [Rate limit](#rate-limit) 및 [`apps/api/README.md`](apps/api/README.md) 참고.
- Redis 연결 smoke test(선택): compose 기동 후 `REDIS_SMOKE=true ./gradlew test --tests RedisCompatibleStoreConnectionTest` (`apps/api`)

- 종료: `Ctrl+C` 후 `docker compose -f compose.local.yml down` (DB 데이터는 volume `dasida-mysql-data` 에 보존)
- volume까지 삭제: `docker compose -f compose.local.yml down -v`
- `compose.local.yml` 의 DB/JWT 값은 **로컬 전용 placeholder**이며 운영 secret 이 아니다.
- Web 컨테이너 SSR 은 compose 내부 `http://api:8080`(`API_INTERNAL_URL`)을, 브라우저는 `http://localhost:8080`(`NEXT_PUBLIC_API_URL`)을 사용한다. web 컨테이너 안에서 `127.0.0.1:8080`은 web 자신을 가리켜 API에 연결되지 않는다.

### Production container images (Docker Hub)

로컬 개발은 `compose.local.yml` + `apps/*/Dockerfile` 을 그대로 사용한다. **운영 배포용 image** 는 `Dockerfile.prod` 와 GitHub Actions [`cd.yml`](.github/workflows/cd.yml) 로 빌드한다. (기존 GHCR 계획에서 **Docker Hub**로 전환.)

| 이벤트 | 동작 |
|--------|------|
| `main` 대상 PR | API/Web image build 검증만 (`push=false`). **자동 머지 없음** — 수동 승인 후 merge |
| `main` push | **CI 성공 후에만** `docker.io/<DOCKERHUB_USERNAME>/dasida-api`, `dasida-web` push (`sha-<shortsha>`, `main` tag) |

실제 서버 배포는 아직 미구현 — `cd.yml` 은 image push 까지만 수행한다. **amd64 VM 배포 runbook** [`single-vm-production-deploy-runbook.md`](apps/api/docs/backend/single-vm-production-deploy-runbook.md), **MySQL backup/restore** [`mysql-backup-restore-runbook.md`](apps/api/docs/backend/mysql-backup-restore-runbook.md). Docker Hub·Nginx는 [`container-images.md`](apps/api/docs/backend/container-images.md), [`nginx-reverse-proxy-deployment.md`](apps/api/docs/backend/nginx-reverse-proxy-deployment.md).

**main merge 전** GitHub Secrets/Variables·Docker Hub·prod 환경·배포 전략 준비는 [`main-release-readiness.md`](apps/api/docs/backend/main-release-readiness.md) 체크리스트를 따른다. Secrets/Environment 상세는 [`github-secrets-and-environments.md`](apps/api/docs/backend/github-secrets-and-environments.md), 운영 값 수집은 [`production-env-values-template.md`](apps/api/docs/backend/production-env-values-template.md). 운영 VM compose **예시 template** 은 [`deploy/compose.prod.example.yml`](deploy/compose.prod.example.yml) 참고.

### 호스트에서 직접 실행 (기존 방식)

#### 1. 의존성 설치

```bash
pnpm install        # JS 워크스페이스(web + packages). apps/api 는 Gradle 전용.
```

#### 2. DB 실행 (백엔드용)

```bash
docker compose up -d   # 루트 docker-compose.yml 의 MySQL 8
```

#### 3. 개발 서버

```bash
pnpm dev:web        # Next.js dev (http://localhost:3000)
pnpm dev:api        # Spring Boot (http://localhost:8080)
```

## 환경 변수

| 변수 | 대상 | 설명 |
|------|------|------|
| `JWT_SECRET` | api | JWT 서명 시크릿(최소 32바이트). prod 에서는 필수 — 미설정 시 기동 실패. |
| `JWT_TTL_MS` | api | access token 만료(ms). 기본 1800000(30분). 만료 시 refresh 로 재발급. |
| `JWT_REFRESH_TTL_MS` | api | refresh token 만료(ms). 기본 1209600000(14일). httpOnly 쿠키(`dasida_refresh`, `Path=/api/auth`)로만 전달, rotation 적용. |
| `JWT_COOKIE_SECURE` | api | 인증 쿠키 `Secure` 속성. 로컬 http 는 `false`(기본), HTTPS 운영은 `true`. |
| `DB_URL` / `DB_USER` / `DB_PASSWORD` | api | MySQL 접속 정보. 기본은 docker-compose 값. |
| `SPRING_DATA_REDIS_HOST` / `SPRING_DATA_REDIS_PORT` | api | Redis-compatible store 접속(compose `local` 프로파일). 기본 `localhost:6379`. |
| `APP_RATE_LIMIT_*` / `app.rate-limit.*` | api | rate limit 정책·store. 기본 `memory`, compose `local` 은 `redis`. 상세는 [Rate limit](#rate-limit) 참고. |
| `APP_CORS_ALLOWED_ORIGINS` | api | **prod 필수.** 허용할 프론트 origin(comma-separated). prod 에서 미설정/`*`/localhost 면 기동 실패. |
| `NEXT_PUBLIC_API_URL` | web | 브라우저(클라이언트) fetch용 API 베이스 URL. Web image build arg 로 bake-in. 기본 `http://localhost:8080`. |
| `API_INTERNAL_URL` | web (런타임) | SSR·Server Components용 API 베이스 URL. Docker Compose 에서 `http://api:8080` 등 내부 DNS. 미설정 시 `NEXT_PUBLIC_API_URL` fallback. 클라이언트 번들에 노출하지 않음. |

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

프론트는 JWT 를 httpOnly 쿠키로 주고받으므로 credentials 를 허용하며, `Authorization`/`Content-Type` 헤더도 허용한다(Bearer 호출도 지원). CORS 허용은 브라우저 origin 정책일 뿐 **인증을 우회하지 않는다** — 인증이 필요한 API 는 여전히 JWT Bearer 토큰이 필요하다.

## 헬스 체크 / Actuator 노출 정책

외부에 공개되는 Actuator endpoint 는 헬스체크용 `/actuator/health` 로 제한한다. 로드밸런서/배포 헬스체크는 이 경로를 사용한다.

- 공개: `GET /actuator/health` (SecurityConfig 에서 이 경로만 permitAll)
- 미노출: `/actuator/env`, `/actuator/beans`, `/actuator/configprops`, `/actuator/mappings`, `/actuator/metrics`, `/actuator/loggers` 등 (web exposure 를 `health` 로만 제한)
- `health` 응답에 `details`/`components` 는 노출하지 않는다 (`management.endpoint.health.show-details=never`).

liveness/readiness probe 는 현재 사용하지 않으며, 배포 환경이 확정된 뒤 별도 PR 에서 검토한다.

## Rate limit

특정 mutation endpoint 에 **클라이언트 IP 기준 fixed-window** rate limit 을 적용한다. 글로벌 API rate limit 은 없다.

| Endpoint | limit / window |
|----------|----------------|
| `POST /api/auth/login` | 20 / 60초 |
| `POST /api/auth/signup` | 10 / 60초 |
| `POST /api/posts/{id}/comments` | 20 / 60초 (댓글 작성 공유 버킷) |
| `POST /api/campaigns/{id}/comments` | 20 / 60초 (댓글 작성 공유 버킷) |
| `POST /api/reports` | 10 / 60초 |

- **초과 응답**: HTTP `429`, `Retry-After` 헤더, Spring 기본 `/error` JSON body
- **Redis key prefix**: `rate-limit:auth:login:ip:`, `rate-limit:auth:signup:ip:`, `rate-limit:comment:create:ip:`, `rate-limit:report:create:ip:` + `{clientIp}`
- **store**: 기본·테스트는 `memory`(`app.rate-limit.store=memory`). compose local(`SPRING_PROFILES_ACTIVE=local`)은 Valkey(`valkey/valkey:8`, compose 서비스명 `redis`)에 `app.rate-limit.store=redis` 로 연결한다.

endpoint·property·회귀 테스트 상세는 [`apps/api/README.md`](apps/api/README.md#rate-limit) 참고.

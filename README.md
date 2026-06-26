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

## 헬스 체크

Spring Actuator: `GET /actuator/health` (health 만 공개).

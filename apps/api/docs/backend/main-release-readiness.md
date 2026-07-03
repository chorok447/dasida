# main release 준비 체크리스트

> **목적**: `develop` → `main` merge(예: PR #149) **전**에 운영 준비가 끝났는지 확인한다.  
> **이 문서는 체크리스트만 제공한다.** secret 값·prod credential 은 **저장소에 커밋하지 않는다.**

## 현재 상태 요약

| 구분 | 상태 |
|------|------|
| develop → main release PR | [PR #149](https://github.com/chorok447/dasida/pull/149) — **기술 gate 통과 후에도 운영 준비 미완 시 merge 보류** |
| main PR auto-merge | **비활성화** (수동 승인 후 merge) |
| Production Docker image (GHCR) | **구현됨** — main push 시 `dasida-api` / `dasida-web` push |
| CD / 실제 서버 배포 | **미구현** (`.github/workflows/cd.yml` placeholder) |
| prod Redis store (rate limit / denylist) | **미적용** — prod 기본은 in-memory ([redis-security-store-policy.md](./redis-security-store-policy.md)) |
| `application-prod.yml` | OpenAPI 비활성·CORS 주입만 정의. DB/Redis/JWT 값 **없음** |

**main merge ≠ production deploy.** main merge 후 GHCR image push까지만 자동이며, **실제 서버 배포는 별도 승인·별도 작업**이다.

---

## 1. GitHub Secrets / Variables

저장소 또는 배포 환경(서버/컨테이너 오케스트레이터)에 주입. **값을 이 문서·코드·커밋에 적지 않는다.**

분류·Environment 전략·main PR/push/deploy 흐름: [github-secrets-and-environments.md](./github-secrets-and-environments.md).

운영 값 수집 체크리스트: [production-env-values-template.md](./production-env-values-template.md).

### 1-1. API (런타임 필수)

| 항목 | 형태 | 설명 | prod 준비 |
|------|------|------|-----------|
| `JWT_SECRET` | Secret | JWT 서명 키(≥32바이트). `dev-insecure` 접두 기본값이면 prod 기동 실패 | [ ] |
| `DB_URL` | Secret | MySQL JDBC URL | [ ] |
| `DB_USER` | Secret | DB 사용자 | [ ] |
| `DB_PASSWORD` | Secret | DB 비밀번호 | [ ] |
| `APP_CORS_ALLOWED_ORIGINS` | Secret 또는 서버 env | 운영 프론트 origin(comma-separated). 미설정/`*`/localhost 시 기동 실패 | [ ] |
| `SPRING_PROFILES_ACTIVE` | env | 운영 시 `prod` | [ ] |

### 1-2. API (Redis / Valkey — prod 다중 인스턴스 시 사실상 필수)

현재 prod 프로파일에는 Redis store 설정이 **없다**. 단일 인스턴스·in-memory 허용이 아니라면 아래를 준비하고 **별도 구현 PR**로 `application-prod`·배포 manifest에 반영한다.

| 항목 | 형태 | 설명 | prod 준비 |
|------|------|------|-----------|
| `SPRING_DATA_REDIS_HOST` | Secret/env | Redis/Valkey 호스트 | [ ] |
| `SPRING_DATA_REDIS_PORT` | env | 포트(기본 6379) | [ ] |
| `SPRING_DATA_REDIS_PASSWORD` | Secret | 인증 사용 시 | [ ] |
| TLS / `rediss://` | 인프라·설정 | managed Redis TLS 요구 시 연결 방식 결정 | [ ] |
| `app.rate-limit.store=redis` | 설정 | rate limit 공유 store ([정책 문서](./redis-security-store-policy.md)) | [ ] TODO |
| `app.auth.denylist.store=redis` | 설정 | logout denylist 공유 store | [ ] TODO |

### 1-3. Web (빌드·런타임)

| 항목 | 형태 | 설명 | prod 준비 |
|------|------|------|-----------|
| `NEXT_PUBLIC_API_URL` | **Repository Variable** (CI) + **build arg** (image) | 운영 API 베이스 URL. Web image는 **빌드 시** bake-in | [ ] |
| `NODE_ENV` | env | `production` (Dockerfile.prod 기본) | [ ] |

CI: `container-images.yml` 은 `vars.NEXT_PUBLIC_API_URL` 을 Web build에 사용한다. 미설정 시 placeholder로 **build 검증만** 통과한다.

### 1-4. GitHub Actions (CI/CD)

| 항목 | 형태 | 설명 | prod 준비 |
|------|------|------|-----------|
| `GITHUB_TOKEN` | 자동 | main push 시 GHCR push (`packages: write`는 push job만) | [ ] 기본 동작 확인 |
| Production deploy secret | — | **아직 없음** (CD 미구현) | N/A |

---

## 2. GHCR (GitHub Container Registry)

| 항목 | 확인 | 체크 |
|------|------|------|
| Image 이름 | `ghcr.io/chorok447/dasida-api`, `ghcr.io/chorok447/dasida-web` | [ ] |
| Tags (main push) | `main`, `sha-<shortsha>` | [ ] |
| Package visibility | private/public 정책 결정(운영 서버 pull 가능해야 함) | [ ] |
| Push 권한 | `main` push workflow (`api-image-push` / `web-image-push`)만 `packages: write` | [ ] |
| Pull 권한 | 배포 서버/런타임에 GHCR read credential 또는 public package | [ ] |
| main PR build-only | `push=false`, `docker/login-action` **skipped** ([container-images.md](./container-images.md)) | [ ] |

상세: [container-images.md](./container-images.md)

---

## 3. prod 인프라 준비

| 영역 | 확인 항목 | 체크 |
|------|-----------|------|
| **API** | Java 21 JRE, 포트 8080, non-root `app` 사용자로 실행 가능한 런타임 | [ ] |
| **Web** | Node 22 + pnpm, 포트 3000, non-root `node` 사용자 | [ ] |
| **MySQL 8** | DB 생성, 네트워크 접근, 백업·복구 절차 | [ ] |
| **Redis/Valkey** | (다중 인스턴스·denylist/rate limit 공유 시) 고가용성·백업 정책 | [ ] |
| **Network** | API↔DB, API↔Redis, Web→API, 인터넷 ingress(HTTPS) | [ ] |
| **Firewall / SG** | 8080/3000/3306/6379 노출 범위 최소화 | [ ] |
| **TLS** | 역방향 프록시 또는 LB에서 HTTPS 종료 | [ ] |
| **도메인** | Web origin, API URL, CORS origin 일치 | [ ] |

---

## 4. prod Spring profile / property 전략

| 항목 | 현재 | 운영 결정 | 체크 |
|------|------|-----------|------|
| Profile | `application-prod.yml` 존재 | `SPRING_PROFILES_ACTIVE=prod` | [ ] |
| OpenAPI/Swagger | prod에서 비활성(404) | 유지 | [ ] |
| CORS | `APP_CORS_ALLOWED_ORIGINS` env 주입 | 운영 origin 확정 | [ ] |
| JWT / DB | `application.properties` placeholder + env override | secret manager 주입 | [ ] |
| Rate limit / denylist store | prod 기본 `memory` | Redis 전환 여부·시점 결정 ([정책](./redis-security-store-policy.md)) | [ ] |
| Actuator | health-only | `/actuator/health` 외부 노출 정책 | [ ] |

**금지**: `application-prod.yml` 또는 코드에 실제 prod secret·credential 작성.

---

## 5. 배포 방식 결정

**1차 추천안**: Docker Compose on VM — 비교·근거·release flow는 [deployment-strategy.md](./deployment-strategy.md) 참고.

아래 중 **하나를 선택**하고 CD workflow·runbook을 후속 PR로 구현한다. **현재는 모두 미구현.**

| 방식 | 적합성 | 비고 | 결정 |
|------|--------|------|------|
| Docker Compose on server | 소규모·단일 서버 | GHCR pull + compose + env file; template: [`deploy/compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml) | [ ] **1차 추천** |
| VM + systemd | 단일 VM 운영 | image 또는 jar + unit file | [ ] |
| Managed container (ECS/Cloud Run/App Service 등) | 관리형 선호 | secret·네트워킹 매핑 필요 | [ ] 추후 |
| **Kubernetes** | 당장 불필요 시 | **보류** | [ ] 보류 |

- [ ] production compose **예시 template** 확인: [`deploy/compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml), [`deploy/.env.prod.example`](../../../../deploy/.env.prod.example) (placeholder만; 서버에서 복사 후 실제 값 주입)

---

## 6. Release gate (develop → main)

main merge **전** GitHub에서 확인:

| Gate | 기대 | 체크 |
|------|------|------|
| develop → main PR checks | CI web/api **pass** | [ ] |
| Container Images | api/web image **build pass**, `push=false` | [ ] |
| CD deploy plan | dry-run **pass** | [ ] |
| CI auto-merge (main PR) | **skipped** | [ ] |
| CodeRabbit / review | blocking comment 없음 | [ ] |
| **이 체크리스트 1~5절** | 운영 준비 완료 또는 **의도적 보류 사유** 문서화 | [ ] |
| main merge | **수동 승인 후** merge (auto-merge 사용 안 함) | [ ] |

---

## 7. main push 직후 (image push, deploy 아님)

| 단계 | 기대 | 체크 |
|------|------|------|
| GHCR push | `dasida-api` / `dasida-web` 에 `main`, `sha-*` tag 생성 | [ ] |
| CD production deploy | **skipped** (placeholder) | [ ] |
| 실제 서버 배포 | **실행하지 않음** — 별도 승인 | [ ] |

---

## 8. Rollback 전략

| 항목 | 확인 | 체크 |
|------|------|------|
| Image tag | 이전 `sha-<shortsha>` 또는 특정 digest로 redeploy | [ ] |
| `main` tag | 최신 main push가 가리키는 image; rollback 시 **고정 sha tag** 사용 권장 | [ ] |
| DB migration | 현재 **Flyway/Liquibase 없음** — schema는 JPA `ddl-auto` 정책 확인 필요 | [ ] |
| Redis 데이터 | rate limit/denylist key는 TTL 기반 — rollback 시 영구 데이터 영향 제한적 | [ ] |
| Web rebuild | `NEXT_PUBLIC_API_URL` 변경 시 **image 재빌드** 필요 | [ ] |

---

## 9. Post-deploy 검증 (실제 배포 승인 후)

배포 구현·실행이 완료된 뒤 수행:

| 항목 | 방법 | 체크 |
|------|------|------|
| GHCR image 존재 | `ghcr.io/chorok447/dasida-api:sha-…` 등 | [ ] |
| Image pull | 배포 서버에서 pull 성공 | [ ] |
| Container boot | API/Web 컨테이너 기동, non-root 사용자 | [ ] |
| Health | `GET /actuator/health` → 200 | [ ] |
| Auth smoke | signup → login → `GET /api/auth/me` | [ ] |
| Logout smoke | logout → 동일 token으로 401 | [ ] |
| Rate limit smoke | login/signup 반복 시 429 + `Retry-After` (Redis store 적용 시 인스턴스 간 일관성 확인) | [ ] |
| CORS | 운영 origin에서 브라우저 API 호출 | [ ] |

---

## 10. PR #149 merge 보류 사유 (예시)

아래가 **하나라도** 미해결이면 main merge를 보류한다:

- [ ] prod `JWT_SECRET` / DB / CORS secret 미준비
- [ ] `NEXT_PUBLIC_API_URL` 운영 값·Web image build arg 미확정
- [ ] GHCR package visibility·pull 권한 미설정
- [ ] prod MySQL·(필요 시) Redis 인프라 미구축
- [ ] 배포 방식·담당·runbook 미결정
- [ ] prod Redis store 전환이 필요한데 미구현
- [ ] 실제 deploy를 main merge와 동시에 진행하려는 경우 (**분리 권장**)

---

## 관련 문서

- [github-secrets-and-environments.md](./github-secrets-and-environments.md) — Secrets/Variables·`production` Environment 전략
- [production-env-values-template.md](./production-env-values-template.md) — 운영 값 수집·검증 체크리스트
- [deployment-strategy.md](./deployment-strategy.md) — production 배포 전략 결정안
- [container-images.md](./container-images.md) — GHCR image·CI 정책
- [redis-security-store-policy.md](./redis-security-store-policy.md) — rate limit / denylist·Redis 정책
- [auth-token-revocation.md](./auth-token-revocation.md) — logout denylist
- [README.md](../../../../README.md) — 환경 변수·CORS·로컬 compose

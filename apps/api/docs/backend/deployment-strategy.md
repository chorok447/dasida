# Production 배포 전략 결정안

> **상태**: 결정안(문서). **실제 배포·CD workflow 구현은 아직 없음.**  
> secret·credential 값은 이 문서에 적지 않는다. [main release 준비 체크리스트](./main-release-readiness.md)와 함께 본다.

## 목적

`develop` → `main` merge 및 GHCR image push **이후**, 운영 서버에 어떻게 배포할지 1차 전략을 고정한다.  
현재 [PR #149](https://github.com/chorok447/dasida/pull/149)는 기술 gate와 별도로 **운영 준비 미완 시 merge 보류** 대상이다.

---

## 배포 후보 비교

| 방식 | 장점 | 단점 | Dasida 적합도 |
|------|------|------|----------------|
| **Docker Compose on VM** | GHCR image 그대로 사용; API/Web/MySQL/Redis를 한 서버에서 단순 기동; 로컬 `compose.local.yml`과 개념 유사 | 단일 VM SPOF; 수동/스크립트 운영 필요; secret은 서버 `.env` 관리 | **★ 1차 추천** |
| **VM + systemd** | OS 서비스로 장기 운영에 익숙; jar 직접 실행도 가능 | image 기반일 때 compose 대비 이점 적음; Web(pnpm) 단위 관리가 번거로움 | 차선 |
| **Managed container** (ECS, Cloud Run, App Service 등) | 오토스케일·관리형 LB·secret 연동 | 초기 설정·비용·벤더 lock-in; 현재 CD 미구현 | **추후 전환 후보** |
| **Kubernetes** | 대규모·다중 리전·고가용 | 현재 팀/트래픽 규모 대비 과함; 운영 부담 큼 | **보류** |
| **정적 Web hosting + API container 분리** | Web을 CDN/정적 호스팅으로 분리 가능 | Next.js `pnpm start`(SSR/동적 라우트)는 **현재 Web image**와 맞지 않음; 별도 static export 전략 필요 | **현 구조와 불일치** (장기 검토) |

---

## 1차 추천: Docker Compose on VM

### 추천 이유

1. **GHCR image와 정합** — `ghcr.io/chorok447/dasida-api`, `dasida-web`를 서버에서 `docker compose pull` 후 기동하면 된다.
2. **구성 단순** — MySQL, Redis/Valkey, API, Web을 하나의 compose stack으로 시작할 수 있다(로컬 `compose.local.yml` 패턴과 유사).
3. **현재 규모에 적합** — 소규모 단일 서버로 시작하고, 트래픽·가용성 요구가 커지면 managed service로 이전 가능.
4. **Kubernetes 불필요** — 당장 replica·HPA·service mesh가 필요하지 않다.

### 아직 구현되지 않은 것 (TODO)

- **예시 template**: [`deploy/compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml) + [`deploy/.env.prod.example`](../../../../deploy/.env.prod.example) — GHCR pull·env 주입 참고용. **실제 서버 deploy/CD 는 아직 없음.**
- CD workflow의 실제 deploy step — [`.github/workflows/cd.yml`](../../../../.github/workflows/cd.yml) placeholder
- GHCR pull 인증(runner/서버 credential) — **미설정**

---

## Docker Compose on VM — 운영 개요

### Image pull

```text
ghcr.io/chorok447/dasida-api:<tag>
ghcr.io/chorok447/dasida-web:<tag>
```

서버에 GHCR read 권한(PAT 또는 deploy 전용 credential)을 두고 pull 한다. package visibility는 GitHub UI에서 정책 확정 필요.

### Tag 전략

| Tag | 용도 | 권장 |
|-----|------|------|
| `sha-<shortsha>` | **배포 고정** — 롤백 단위 | **운영 배포는 이 tag를 pin** |
| `main` | 최신 main 추적·참조용 | 자동 redeploy 트리거로만 쓰지 말 것(의도치 않은 업그레이드 방지) |

main merge 후 GHCR에 `sha-*`와 `main`이 함께 push 된다([container-images.md](./container-images.md)).

### Runtime env 주입

- **서버 `.env`** 또는 **호스트 secret manager**(1Password, cloud SM 등)로 주입.
- **GitHub repository secret에 prod DB/JWT를 넣지 않아도 됨** — 배포 주체가 서버라면 서버 측 주입이 1차 추천.
- Web image의 `NEXT_PUBLIC_API_URL`은 **image build 시 bake-in** — 운영 URL 확정 후 해당 `sha-*` Web image를 빌드·배포해야 한다(`vars.NEXT_PUBLIC_API_URL` 또는 build arg).

### DB / Redis: compose 내장 vs external

| 옵션 | 장점 | 단점 | 1차 권장 |
|------|------|------|----------|
| **External managed DB/Redis** | 백업·패치·HA 위임; compose는 API/Web만 | 비용·네트워크 설정 | **운영 인프라 확정 전까지 권장** |
| **Compose에 MySQL/Valkey 포함** | 단일 VM으로 빠른 시작 | 데이터 durability·백업 직접 책임; VM 장애 시 DB 동반 | 개발/스테이징·초기 PoC |

prod 다중 API replica를 쓸 경우 rate limit·logout denylist는 **공유 Redis store**가 필요하다([redis-security-store-policy.md](./redis-security-store-policy.md)). 그 전까지는 단일 API 인스턴스 + in-memory store도 가능하나, scale-out 시 **Redis 전환 + external Redis**가 선행되어야 한다.

---

## 필요한 운영 변수 (이름만)

값은 서버 env / secret manager에만 둔다. **저장소·이 문서에 커밋하지 않는다.**

### API

| 변수 | 비고 |
|------|------|
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `JWT_SECRET` | ≥32바이트, `dev-insecure` 접두 금지 |
| `DB_URL` | JDBC URL |
| `DB_USER` | MySQL 사용자 |
| `DB_PASSWORD` | MySQL 비밀번호 |
| `APP_CORS_ALLOWED_ORIGINS` | 운영 Web origin(comma-separated) |
| `SPRING_DATA_REDIS_HOST` | Redis/Valkey (store 전환·다중 인스턴스 시) |
| `SPRING_DATA_REDIS_PORT` | 기본 6379 |
| `SPRING_DATA_REDIS_PASSWORD` | 인증 사용 시 |

추가 설정(별도 구현 PR): `app.rate-limit.store=redis`, `app.auth.denylist.store=redis`.

### Web

| 변수 | 비고 |
|------|------|
| `NEXT_PUBLIC_API_URL` | **build arg** — 운영 API URL. 런타임 env만으로는 이미 빌드된 image에서 바뀌지 않음 |

`NODE_ENV=production`은 `Dockerfile.prod` 기본값.

---

## Release flow (현재 정책)

```mermaid
flowchart LR
  A[develop PR] -->|auto-merge| B[develop]
  B --> C[develop → main PR #149]
  C -->|수동 승인 merge| D[main push]
  D --> E[GHCR push sha-* + main]
  E --> F[서버: image pull]
  F --> G[compose up / health check]
  G -->|실패| H[이전 sha-* 로 rollback]
```

| 단계 | 동작 | 현재 상태 |
|------|------|-----------|
| develop PR | CI pass 후 **auto-merge** | 구현됨 |
| develop → main PR | CI + container build 검증; **수동 merge** | PR #149 OPEN·보류 |
| main push | GHCR `dasida-api` / `dasida-web` push | merge 후 자동 |
| 서버 deploy | pull + compose + health | **미구현** |
| rollback | 이전 `sha-<shortsha>` tag로 redeploy | runbook만(문서) |

### Post-deploy smoke (배포 구현 후)

- GHCR image pull 성공
- container 기동(non-root)
- `GET /actuator/health` → 200
- signup / login / logout / rate limit 기본 smoke
- 브라우저 CORS (운영 origin)

---

## Rollback

1. 배포 시 사용한 `sha-<shortsha>` 를 배포 기록에 남긴다.
2. 장애 시 compose manifest의 image tag를 **이전 sha**로 되돌리고 `docker compose up -d` (또는 동일 runbook).
3. `main` tag는 “최신” pointer이므로 rollback pin으로 쓰지 않는다.
4. Web URL 변경이 있었다면 해당 시점의 **Web image sha**도 함께 되돌려야 한다.
5. DB schema migration 도구는 현재 없음 — rollback은 **애플리케이션 image** 수준.

---

## 후속 작업 (코드/인프라 PR로 분리)

1. ~~운영 compose manifest 초안~~ → **예시 template** [`deploy/compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml) (서버 runbook·실제 `compose.prod.yml` 은 deploy 시 복사·커스터마이즈)
2. 서버 runbook: GHCR login, pull, deploy, rollback
3. CD workflow에 opt-in deploy job (명시 승인 후)
4. prod Redis store 설정 PR (필요 시)
5. [main-release-readiness.md](./main-release-readiness.md) 체크리스트 항목 완료

---

## 관련 문서

- [github-secrets-and-environments.md](./github-secrets-and-environments.md) — Secrets/Variables·Environment
- [main-release-readiness.md](./main-release-readiness.md) — merge 전 체크리스트
- [container-images.md](./container-images.md) — GHCR·CI
- [redis-security-store-policy.md](./redis-security-store-policy.md) — rate limit / denylist

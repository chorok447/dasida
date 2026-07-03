# Production 환경값 수집 템플릿

> **용도**: GitHub Secrets/Variables·`production` Environment·서버 `.env.prod` 생성 **전** 운영 값을 안전하게 수집·검토하는 체크리스트.  
> **이 문서에 실제 secret/credential 값을 적지 않는다.** 값은 1Password·비공개 시트·서버 전용 파일 등 **Git 제외 저장소**에만 기록한다.

관련: [github-secrets-and-environments.md](./github-secrets-and-environments.md), [main-release-readiness.md](./main-release-readiness.md), [Secrets 설정 runbook](./github-secrets-setup-runbook.md), [nginx-reverse-proxy-deployment.md](./nginx-reverse-proxy-deployment.md), [single-vm-production-deploy-runbook.md](./single-vm-production-deploy-runbook.md), [deploy/.env.prod.example](../../../../deploy/.env.prod.example).

---

## 사용 방법

1. 아래 표를 복사해 팀 내부 도구(비공개)에 붙여 넣는다.
2. **Value** 열은 내부 문서에만 채운다 — 이 저장소·PR·이슈에 붙여넣지 않는다.
3. `owner / decision needed` 가 남은 항목은 main merge 또는 deploy 전에 해소한다.
4. `validation rule` 을 통과하지 못하면 prod 기동·배포를 진행하지 않는다.

### 상태 기호 (내부 추적용)

| 기호 | 의미 |
|------|------|
| `—` | 아직 미수집 |
| `draft` | 초안 있음, 검증 전 |
| `ok` | validation 통과, 주입 위치 확정 |
| `n/a` | 해당 없음 |

---

## 수집 체크리스트

### Repository Variable

| name | GitHub target | required before main merge | required before deploy | validation rule | owner / decision needed |
|------|---------------|---------------------------|------------------------|-----------------|-------------------------|
| `NEXT_PUBLIC_API_URL` | Repository Variable | **no** (CI placeholder로 main PR 가능) | **yes** (Web image build) | 운영 API **public** URL (`https://` 권장). 예: `https://api.example.com` ([Nginx 배포안](./nginx-reverse-proxy-deployment.md)). localhost·내부 전용 URL만 있으면 Web 빌드 의미 없음. trailing slash 없이 base URL. **도메인 확정 전 등록 보류** | Web/API 도메인 확정 |
| `API_INTERNAL_URL` | 서버 `.env.prod` (web runtime) | no | **yes** (compose SSR) | compose 내부 API URL. 예: `http://api:8080`. web 컨테이너 SSR 전용 — `NEXT_PUBLIC_` 접두 없음 | compose web env |
| `DOCKERHUB_USERNAME` | Repository Variable | **no** (main PR build-only 가능) | **yes** (main push image publish) | Docker Hub **실제 계정명**. image: `docker.io/<username>/dasida-api|web` | Docker Hub 계정 확정 |

### API runtime (서버 `.env.prod` 1차 권장)

| name | GitHub target | required before main merge | required before deploy | validation rule | owner / decision needed |
|------|---------------|---------------------------|------------------------|-----------------|-------------------------|
| `JWT_SECRET` | 서버 전용 (또는 secret manager) | no | **yes** | ≥32 bytes. `dev-insecure` 접두·저장소 기본값 재사용 금지. **실제 값 문서화 금지** | 인프라/보안 |
| `DB_URL` | 서버 전용 | no | **yes** | prod MySQL JDBC endpoint. `localhost`·`127.0.0.1` 금지. SSL/TLS 정책에 맞는 query param | DB 호스트·DB명 확정 |
| `DB_USER` | 서버 전용 | no | **yes** | prod 전용 DB 사용자. root 공유 계정 비권장 | DBA |
| `DB_PASSWORD` | 서버 전용 | **yes** | **yes** | 강한 랜덤 비밀번호. Git·Slack·이슈에 붙여넣기 금지 | DBA |
| `MYSQL_ROOT_PASSWORD` | 서버 전용 | no | **yes** (single VM compose 시) | MySQL root 비밀번호. `DB_PASSWORD` 와 분리 권장. **값 문서화 금지** | DBA |
| `APP_CORS_ALLOWED_ORIGINS` | 서버 전용 | no | **yes** | 운영 Web origin만(comma-separated). 예: `https://example.com` ([Nginx 배포안](./nginx-reverse-proxy-deployment.md)). `*`·`localhost`·`127.0.0.1` 금지 ([README CORS](../../../../README.md#cors-설정)) | Web 도메인 = CORS origin 일치 |

`SPRING_PROFILES_ACTIVE=prod` 는 고정값 — 별도 secret 아님([`.env.prod.example`](../../../../deploy/.env.prod.example)).

### Redis / Valkey runtime

| name | GitHub target | required before main merge | required before deploy | validation rule | owner / decision needed |
|------|---------------|---------------------------|------------------------|-----------------|-------------------------|
| `SPRING_DATA_REDIS_HOST` | 서버 전용 | no | **yes** (다중 인스턴스·Redis store 시) | managed Redis/Valkey hostname. `localhost` 금지(prod) | Redis 인프라 확정 |
| `SPRING_DATA_REDIS_PORT` | 서버 전용 | no | **yes** (Redis 사용 시) | 숫자 포트(기본 6379). 비표준 포트면 방화벽 규칙 확인 | 인프라 |
| `SPRING_DATA_REDIS_PASSWORD` | 서버 전용 | no | **yes** (single VM·Redis auth 시) | Valkey `requirepass` 와 **동일 값**. [`compose.single-vm.example.yml`](../../../../deploy/compose.single-vm.example.yml) | Redis ACL/TLS 정책 |

prod Redis store(`app.rate-limit.store=redis`, `app.auth.denylist.store=redis`)는 **별도 구현 PR** 전제. 단일 API 인스턴스·in-memory 허용 시 deploy 직전 필수는 아님.

### Deploy automation (향후 CD)

| name | GitHub target | required before main merge | required before deploy | validation rule | owner / decision needed |
|------|---------------|---------------------------|------------------------|-----------------|-------------------------|
| `DEPLOY_HOST` | Environment Secret (`production`) | no | **yes** (자동 deploy 시) | prod 서버 FQDN 또는 IP. SSH 도달 가능 | 배포 대상 VM |
| `DEPLOY_USER` | Environment Secret (`production`) | no | **yes** (자동 deploy 시) | non-root 또는 sudo 제한된 deploy 전용 계정 권장 | 인프라 |
| `DEPLOY_SSH_KEY` | Environment Secret (`production`) | no | **yes** (자동 deploy 시) | **GitHub Environment secret 권장**. deploy 전용 key pair. private key는 Git 커밋 금지 | 인프라/보안 |
| `DEPLOY_PATH` | Environment Secret 또는 Variable | no | **yes** (자동 deploy 시) | 서버上的 `compose.prod.yml`·`.env.prod` 디렉터리 절대 경로 | runbook |

당장 CD deploy job 은 **미구현** — 위 항목은 자동화 PR 전까지 `n/a` 가능.

### Docker Hub image publish (CI)

| name | GitHub target | required before main merge | required before deploy | validation rule | owner / decision needed |
|------|---------------|---------------------------|------------------------|-----------------|-------------------------|
| `DOCKERHUB_TOKEN` | Repository Secret | no | **yes** (main push 시) | Docker Hub access token (read/write). **값 문서화·커밋 금지** | Docker Hub 계정 |

main merge **후** main push 가 Docker Hub 에 image 를 올리므로, **첫 main push 전** `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN` 등록이 필요하다. main PR build-only 는 token 없이 통과한다.

### Optional / server env

| name | GitHub target | required before main merge | required before deploy | validation rule | owner / decision needed |
|------|---------------|---------------------------|------------------------|-----------------|-------------------------|
| `DOCKERHUB_USERNAME` | 서버 `.env.prod` (compose pull) | no | **yes** | GitHub Variable 과 **동일 계정명**. placeholder `your-dockerhub-username` 교체 | Docker Hub 계정 |
| `DASIDA_IMAGE_TAG` | 서버 `.env.prod` (권장) | no | **yes** | `sha-<shortsha>` pin. **`main` tag를 deploy pin으로 쓰지 않음** | release 담당 |

**미사용 (GHCR 전환 이전)**: `GHCR_API_IMAGE`, `GHCR_WEB_IMAGE` — 등록하지 않음.

---

## required before main merge — 요약

| 분류 | main merge 전 필수 |
|------|-------------------|
| GitHub Repository Secret/Variable | **없음** (기술 gate만 통과하면 merge 가능) |
| 운영 인프라·도메인 결정 | 권장(보류 사유 해소) |
| `NEXT_PUBLIC_API_URL` Variable | merge 전 필수 아님; **운영 Web image 빌드·deploy 전 필수** |

[PR #149](https://github.com/chorok447/dasida/pull/149) 는 기술 gate + [main-release-readiness.md](./main-release-readiness.md) 운영 준비가 충족된 뒤 **수동 merge**.

---

## required before deploy — 요약

| 분류 | deploy 전 필수 |
|------|----------------|
| `NEXT_PUBLIC_API_URL` (Variable) + 해당 sha Web image | **yes** |
| API runtime (JWT, DB, CORS) on 서버 `.env.prod` | **yes** |
| Redis (공유 store·다중 인스턴스) | 조건부 **yes** |
| `DASIDA_IMAGE_TAG=sha-*` | **yes** |
| `DEPLOY_*` (자동 deploy) | 자동화 구현 시 **yes** |
| GitHub Environment `production` | 자동 deploy + 승인 gate 시 **yes** |

---

## validation rule 빠른 참조

| name | rule (값 예시 금지) |
|------|---------------------|
| `JWT_SECRET` | ≥32 bytes; `dev-insecure*` 금지 |
| `DB_URL` | prod endpoint; localhost 금지 |
| `APP_CORS_ALLOWED_ORIGINS` | 운영 Web origin만; `*`/localhost 금지 |
| `NEXT_PUBLIC_API_URL` | 운영 public API URL |
| `SPRING_DATA_REDIS_PORT` | 숫자 포트 |
| `DEPLOY_SSH_KEY` | Environment secret; Git 커밋 금지 |
| `DASIDA_IMAGE_TAG` | `sha-*` pin; `main`은 추적용만 |

---

## 관련 문서

- [github-secrets-and-environments.md](./github-secrets-and-environments.md)
- [github-secrets-setup-runbook.md](./github-secrets-setup-runbook.md)
- [main-release-readiness.md](./main-release-readiness.md)
- [deployment-strategy.md](./deployment-strategy.md)

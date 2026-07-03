# GitHub Secrets 설정 runbook

> **용도**: Repository Secrets/Variables·`production` Environment 를 **실제로 생성할 때** 따르는 절차.  
> **이 runbook 에 secret 값을 적지 않는다.** 값은 GitHub UI/CLI 입력 시에만 붙여넣고, 로그·PR·이슈·커밋에 남기지 않는다.

선행 문서: [전략](./github-secrets-and-environments.md), [수집 체크리스트](./production-env-values-template.md), [main release 준비](./main-release-readiness.md).

**현재 상태**: custom Repository Secrets/Variables·`production` Environment **미생성**(문서·runbook만 존재).

---

## 값 다루기 원칙 (필수)

| 금지 | 이유 |
|------|------|
| `gh secret list` 외 **secret 값 조회** (`gh secret get` 등) | 터미널·CI 로그 노출 위험 |
| PR 본문·이슈·Slack·커밋에 secret 붙여넣기 | 영구 기록·검색 노출 |
| 로컬 `.env.prod` 를 Git 에 커밋 | [`.gitignore`](../../../../.gitignore) 로 `deploy/.env.prod` 제외 |
| main PR workflow 로그에 secret echo | workflow 에서 production secret 미사용 정책 유지 |

**허용**

- `gh secret list` / `gh variable list` — **이름**(및 Variable 의 **비밀 아닌 값**)만 확인
- [production-env-values-template.md](./production-env-values-template.md) 에서 내부 도구로 값 수집 후, UI/CLI에만 입력

---

## GitHub UI 경로

저장소: `chorok447/dasida` (또는 조직 소유 시 해당 repo)

| 대상 | UI 경로 |
|------|---------|
| Actions secrets/variables | **Settings** → **Secrets and variables** → **Actions** |
| Repository secrets | 위 화면 → **Secrets** 탭 → **Repository secrets** → **New repository secret** |
| Repository variables | 위 화면 → **Variables** 탭 → **Repository variables** → **New repository variable** |
| Environments | **Settings** → **Environments** → **New environment** → 이름 `production` |
| Environment secrets | **Environments** → **production** → **Environment secrets** → **Add secret** |
| Environment protection | **production** → **Required reviewers** / **Wait timer** (승인 gate) |

Environment `production` 은 **deploy automation PR 적용 전**까지 생성해도 되고, deploy 직전에 생성해도 된다. protection rule 은 deploy job 연결 시 함께 켠다.

---

## CLI 확인 (이름만)

```bash
# Repository secrets — 이름만 출력 (값 없음)
gh secret list

# Repository variables — 이름 + 비밀 아닌 값
gh variable list

# Environment 목록 (production 존재 여부)
gh api repos/chorok447/dasida/environments --jq '.environments[].name'
```

**하지 말 것**: secret 값을 stdout/파일로 덤프하는 명령, 스크린샷에 값 포함.

### Secret 생성 (예시 — 값은 터미널에서만 입력)

```bash
# stdin 으로 전달 (셸 history 에 남지 않게 주의)
gh secret set JWT_SECRET < /path/to/local-only-secret-file

# 또는 프롬프트 (로그에 남지 않도록 CI 에서 사용 금지)
gh secret set JWT_SECRET
```

Runtime secret 을 **서버 `.env.prod`에만** 둘 경우 GitHub 에 `JWT_SECRET` 등을 등록하지 않아도 된다([전략 문서](./github-secrets-and-environments.md)).

---

## 권장 생성 순서

각 단계 전 [production-env-values-template.md](./production-env-values-template.md) validation 을 통과했는지 확인한다.

### 1단계 — Repository Variable

| 이름 | UI | 비고 |
|------|-----|------|
| `NEXT_PUBLIC_API_URL` | Repository **variable** | 운영 API public URL. Web image build(`container-images.yml`)에 사용 |

main merge **전** 필수는 아님. **운영 Web image 빌드·deploy 전** 필수.

### 2단계 — API runtime (주입 위치 선택)

**A. 서버 전용 (1차 권장)** — GitHub 등록 없이 서버 `deploy/.env.prod` 만 작성 ([`.env.prod.example`](../../../../deploy/.env.prod.example)).

**B. Repository / Environment secret** — CI/CD에서 주입할 때만:

| 이름 | 권장 위치 |
|------|-----------|
| `JWT_SECRET` | 서버 `.env.prod` 또는 Secret |
| `DB_URL` | 서버 `.env.prod` 또는 Secret |
| `DB_USER` | 서버 `.env.prod` 또는 Secret |
| `DB_PASSWORD` | 서버 `.env.prod` 또는 Secret |
| `APP_CORS_ALLOWED_ORIGINS` | 서버 `.env.prod` 또는 Secret |

### 3단계 — Redis (사용·공유 store 시)

| 이름 | 권장 위치 |
|------|-----------|
| `SPRING_DATA_REDIS_HOST` | 서버 `.env.prod` |
| `SPRING_DATA_REDIS_PORT` | Variable 또는 `.env.prod` (비밀 아님) |
| `SPRING_DATA_REDIS_PASSWORD` | Secret 또는 `.env.prod` (인증 시) |

### 4단계 — Deploy automation (향후 CD PR)

Environment **`production`** 에 두는 것을 권장:

| 이름 | 용도 |
|------|------|
| `DEPLOY_HOST` | SSH 대상 호스트 |
| `DEPLOY_USER` | SSH 사용자 |
| `DEPLOY_SSH_KEY` | deploy 전용 private key |
| `DEPLOY_PATH` | 서버 compose/env 경로 |

CD workflow·`environment: production` 은 **아직 미구현**.

---

## 생성 후 검증 절차

1. **이름 확인**
   ```bash
   gh secret list
   gh variable list
   ```
   기대한 이름이 있는지 확인. **값은 확인하지 않는다.**

2. **Environment**
   ```bash
   gh api repos/chorok447/dasida/environments --jq '.environments[].name'
   ```
   deploy 자동화 준비 시 `production` 포함 여부 확인.

3. **main PR / GHCR**
   - [PR #149](https://github.com/chorok447/dasida/pull/149) 는 운영 준비·명시 승인 전까지 **merge 하지 않음**
   - main merge **전** `container-images` main **push** 이벤트 없음 → GHCR prod push **없음** (정상)
   ```bash
   gh run list --workflow=container-images.yml --event push --limit 3
   ```

4. **workflow 동작 (선택)**
   - `NEXT_PUBLIC_API_URL` 설정 후 main 대상 PR 에서 Web image build 가 placeholder 대신 Variable 을 쓰는지 Actions 로그에서 **변수 이름**만 확인 (값이 로그에 찍히지 않는지)

5. **서버 `.env.prod` (runtime secret 을 서버에 둔 경우)**
   - `deploy/.env.prod` 가 Git 에 없는지: `git status` / `.gitignore` 에 `deploy/.env.prod` 포함 확인
   - compose config 만 로컬 검증: `docker compose -f deploy/compose.prod.example.yml --env-file deploy/.env.prod config` (**`.env.prod` 커밋 금지**)

---

## 보안 주의사항

| 항목 | 규칙 |
|------|------|
| `JWT_SECRET` | ≥32 bytes; `dev-insecure` 접두·저장소 기본값 재사용 금지 |
| `APP_CORS_ALLOWED_ORIGINS` | 운영 Web origin만; `*`·`localhost`·`127.0.0.1` 금지 |
| `DB_URL` | prod endpoint; `localhost` 금지 |
| `DEPLOY_SSH_KEY` | **deploy 전용** key pair; 개인 일상 키 재사용 금지 |
| SSH 권한 | deploy 계정 최소 권한(sudo 제한, docker group만 등) |
| `production` Environment | Required reviewers 등 **approval gate** 권장 |
| Secret rotation | 새 값 등록 → 서버 `.env.prod` 또는 GitHub secret 갱신 → 해당 `sha-*` image 로 **재배포** |
| Web URL | `NEXT_PUBLIC_API_URL` 변경 시 **Web image 재빌드** 필요 |

---

## 관련 문서

- [github-secrets-and-environments.md](./github-secrets-and-environments.md)
- [production-env-values-template.md](./production-env-values-template.md)
- [main-release-readiness.md](./main-release-readiness.md)
- [deployment-strategy.md](./deployment-strategy.md)

# Production container images

API/Web 배포용 Docker image 빌드 정책. **실제 서버 배포는 아직 미구현**이다(CD workflow placeholder).

## Dockerfile

| 용도 | API | Web |
|------|-----|-----|
| 로컬 개발 (`compose.local.yml`) | `apps/api/Dockerfile` | `apps/web/Dockerfile` |
| Production image (GHCR) | `apps/api/Dockerfile.prod` | `apps/web/Dockerfile.prod` |

- API: Java 21 multi-stage (Gradle `bootJar` → JRE runtime). 운영 secret/env 기본값은 Dockerfile 에 넣지 않는다.
- Web: Node 22 + pnpm 11.9.0, monorepo root context. `NEXT_PUBLIC_API_URL` 은 build arg 로 주입(운영 URL 하드코딩 없음).

## GitHub Actions (`container-images.yml`)

| 이벤트 | 동작 |
|--------|------|
| `main` 대상 PR (Ready) | API/Web image **build 검증만** (`push=false`). **자동 머지 없음**(수동 승인 후 merge) |
| `main` push (merge 이후) | API/Web image build + **GHCR push** |

- **develop** 대상 Ready PR 은 `ci.yml` auto-merge 가 그대로 동작한다.
- **develop** 대상 PR/push 에서는 container image workflow 가 실행되지 않는다.
- `pull_request` job 에서 production secret 을 사용하지 않는다. GHCR login 은 `GITHUB_TOKEN`(`packages: write`)만 main push 에서 사용한다.

## Image name / tag

| Image | GHCR name | Tags (main push) |
|-------|-----------|------------------|
| API | `ghcr.io/chorok447/dasida-api` | `sha-<shortsha>`, `main` |
| Web | `ghcr.io/chorok447/dasida-web` | `sha-<shortsha>`, `main` |

Web CI build 시 `NEXT_PUBLIC_API_URL` 은 repository variable `vars.NEXT_PUBLIC_API_URL` 로 주입한다. 미설정 시 CI 검증용 placeholder 를 사용한다.

## 로컬 prod Dockerfile 검증

```bash
docker build -f apps/api/Dockerfile.prod -t dasida-api:local apps/api
docker build -f apps/web/Dockerfile.prod \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 \
  -t dasida-web:local .
```

# Production container images

API/Web 배포용 Docker image 빌드 정책. **실제 서버 배포는 아직 미구현**이다(CD workflow placeholder).

**Registry**: 기존 GHCR 계획에서 **Docker Hub**로 전환. image 이름은 `docker.io/<DOCKERHUB_USERNAME>/dasida-api|web`.

**main merge 전** 운영 준비(GitHub Secrets/Variables, Docker Hub, prod 인프라, 배포 전략)는 [main release 준비 체크리스트](./main-release-readiness.md)를 확인한다.

## Dockerfile

| 용도 | API | Web |
|------|-----|-----|
| 로컬 개발 (`compose.local.yml`) | `apps/api/Dockerfile` | `apps/web/Dockerfile` |
| Production image (Docker Hub) | `apps/api/Dockerfile.prod` | `apps/web/Dockerfile.prod` |

- API: Java 21 multi-stage (Gradle `bootJar` → JRE runtime). runtime 은 non-root `app` 사용자로 실행한다. 운영 secret/env 기본값은 Dockerfile 에 넣지 않는다.
- Web: Node 22 + pnpm 11.9.0, monorepo root context. runtime 은 non-root `node` 사용자로 실행한다. `NEXT_PUBLIC_API_URL` 은 build arg 로 주입(운영 URL 하드코딩 없음).

## GitHub Actions (`container-images.yml`)

| 이벤트 | 동작 |
|--------|------|
| `main` 대상 PR (Ready) | API/Web image **build 검증만** (`push=false`). **Docker Hub login 없음**. **자동 머지 없음**(수동 승인 후 merge) |
| `main` push (merge 이후) | API/Web image build + **Docker Hub push** (`DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN`) |

- **develop** 대상 Ready PR 은 `ci.yml` auto-merge 가 그대로 동작한다.
- **develop** 대상 PR/push 에서는 container image workflow 가 실행되지 않는다.
- `pull_request` job 에서 production secret 을 사용하지 않는다. PR build-only job 은 `contents: read` 만; `DOCKERHUB_TOKEN` 은 main push job 에서만 사용한다.

## Image name / tag

| Image | Docker Hub name | Tags (main push) |
|-------|-----------------|------------------|
| API | `docker.io/<DOCKERHUB_USERNAME>/dasida-api` | `sha-<shortsha>`, `main` |
| Web | `docker.io/<DOCKERHUB_USERNAME>/dasida-web` | `sha-<shortsha>`, `main` |

`<DOCKERHUB_USERNAME>` 은 Repository Variable `vars.DOCKERHUB_USERNAME` 으로 주입한다. PR build 검증 시 Variable 미설정이면 `dasida-ci-placeholder` 를 metadata 에만 사용한다(push 없음).

**배포 pin**: 운영 서버·compose 는 `sha-<shortsha>` tag 를 고정한다. `main` tag 는 최신 main 추적용이며 rollback pin 으로 쓰지 않는다.

Web CI build 시 `NEXT_PUBLIC_API_URL` 은 repository variable `vars.NEXT_PUBLIC_API_URL` 로 주입한다. 미설정 시 CI 검증용 placeholder 를 사용한다.

## GitHub Secrets / Variables (image publish)

| 이름 | 종류 | 용도 |
|------|------|------|
| `DOCKERHUB_USERNAME` | Repository Variable | Docker Hub namespace (실제 계정명) |
| `DOCKERHUB_TOKEN` | Repository Secret | Docker Hub access token (main push login) |
| `NEXT_PUBLIC_API_URL` | Repository Variable | Web image build arg (운영 API URL) |

`DOCKERHUB_*` 는 **main push 전** 등록해야 push job 이 성공한다. main PR build-only 는 token 없이 통과한다.

## 로컬 prod Dockerfile 검증

```bash
docker build -f apps/api/Dockerfile.prod -t dasida-api:local apps/api
docker build -f apps/web/Dockerfile.prod \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 \
  -t dasida-web:local .
```

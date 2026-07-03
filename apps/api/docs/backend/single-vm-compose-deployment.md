# Single VM Docker Compose 배포 전략

> **상태**: 결정안(문서). **실제 서버·DNS·TLS·deploy·secret 등록은 아직 없음.**  
> secret·credential·실제 도메인·서버 IP 는 이 문서에 적지 않는다.

## 목적

초기 운영을 **VM 1대**에서 시작한다. **Host Nginx**가 public ingress(80/443)를 담당하고, **Docker Compose**가 `web` / `api` / `mysql` / `redis`(Valkey) 를 같은 호스트에서 실행한다.

- 상위 ingress·도메인: [nginx-reverse-proxy-deployment.md](./nginx-reverse-proxy-deployment.md)
- 배포 방식 비교: [deployment-strategy.md](./deployment-strategy.md)
- 현재 [`deploy/compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml) 은 **api/web 만** 포함(external DB/Redis 전제). single VM 에서 mysql/redis 를 compose 에 넣는 구성은 **서버 측 override compose** 로 후속 적용한다(이번 문서는 전략만, template 파일 변경 없음).

### 현재 전제 (2026-07-03)

| 항목 | 상태 |
|------|------|
| Docker Hub image | `chorok446/dasida-api|web` — `sha-af5082c` 등 push·smoke 완료 |
| 서버 / VM | **없음** |
| [`compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml) | api/web only — **변경 없음** |
| CD / 실제 deploy | **미구현** |

---

## 권장 운영 구조

```text
Internet
  ↓
Host Nginx :80 / :443          (TLS 종료, vhost 라우팅)
  ├─ https://example.com       → 127.0.0.1:3000  (web container)
  └─ https://api.example.com   → 127.0.0.1:8080  (api container)
                                      ↓
                    Docker Compose (default bridge / internal network)
                    ├─ web   :3000
                    ├─ api   :8080
                    ├─ mysql :3306   (compose 내부만, public 금지)
                    └─ redis :6379   (compose 내부만, public 금지)
```

### 역할 분담

| 구성 요소 | 실행 방식 | 외부 노출 |
|-----------|-----------|-----------|
| Nginx | **호스트** 설치 | **80, 443** 만 |
| web, api | Docker Compose | Nginx 경유만 (직접 3000/8080 인터넷 노출 금지) |
| MySQL 8 | Docker Compose | **public 금지** — service name `mysql` 등 내부 DNS |
| Redis/Valkey | Docker Compose | **public 금지** — service name `redis` 등 내부 DNS |

로컬 개발 참고: 루트 [`compose.local.yml`](../../../../compose.local.yml) 에 mysql/redis/api/web 패턴이 있다. 운영 single VM 은 이와 **개념적으로 유사**하나 image 는 Docker Hub `sha-*` pin, env 는 prod secret, 포트 publish 는 localhost bind 를 권장한다.

---

## Docker Hub image

| 항목 | 정책 |
|------|------|
| Registry | `docker.io/chorok446/dasida-api`, `dasida-web` |
| Deploy pin | **`sha-<shortsha>`** (예: `sha-af5082c`) |
| `main` tag | 최신 추적용 — **deploy pinning 아님** |
| Platform | CI image `linux/amd64` — Apple Silicon 로컬은 `--platform linux/amd64` ([container-images.md](./container-images.md)) |

서버 `.env.prod` 예:

```text
DOCKERHUB_USERNAME=chorok446
DASIDA_IMAGE_TAG=sha-af5082c
```

---

## Compose stack (개념)

### api / web

- [`deploy/compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml) 를 서버에 복사해 `compose.prod.yml` 로 사용.
- image: `${DOCKERHUB_USERNAME}/dasida-api|web:${DASIDA_IMAGE_TAG}`
- api env: `JWT_SECRET`, `DB_*`, `APP_CORS_ALLOWED_ORIGINS`, `SPRING_DATA_REDIS_*` — [`deploy/.env.prod.example`](../../../../deploy/.env.prod.example) 참고(서버에서만 실제 값).

### mysql / redis (single VM, 서버 override)

현재 repo template 에는 **없음**. VM 1대 초기 배포 시 서버에만 `compose.override.yml` 또는 통합 manifest 를 추가하는 방식을 권장한다.

| Service | Image (예) | 포트 publish | Volume |
|---------|------------|--------------|--------|
| `mysql` | `mysql:8.4` | **없음** (또는 `127.0.0.1:3306:3306` — 디버그 시에만) | named volume `dasida-mysql-data` |
| `redis` | `valkey/valkey:8` | **없음** | AOF/RDB 정책에 따라 volume 선택 |

**api env (compose 내부 DNS 예, placeholder host)**

```text
DB_URL=jdbc:mysql://mysql:3306/dasida?useSSL=false&serverTimezone=Asia/Seoul&characterEncoding=utf8
SPRING_DATA_REDIS_HOST=redis
SPRING_DATA_REDIS_PORT=6379
```

> managed DB/Redis 로 이전 시 `DB_URL`·`SPRING_DATA_REDIS_HOST` 만 바꾸면 되도록 **호스트명을 env 로 주입**한다. `localhost` 는 prod 에서 피한다.

### 포트 publish 권장 (api/web)

Nginx 와 같은 호스트일 때:

```yaml
# 서버 측 override 개념 — repo template 미포함
ports:
  - "127.0.0.1:3000:3000"   # web
  - "127.0.0.1:8080:8080"   # api
```

방화벽: 인터넷 → **80/443 만** 허용. 3000/8080/3306/6379 는 외부 SG 에서 차단.

---

## Volume · backup

| 데이터 | Volume | Backup |
|--------|--------|--------|
| MySQL | `dasida-mysql-data` (named volume) | **필수** — dump 스케줄·복구 drill |
| Redis/Valkey | 선택(volume 또는 ephemeral) | rate limit/denylist 위주면 재기동 허용 가능; 정책에 따라 결정 |
| Container image | stateless | Docker Hub `sha-*` 로 재 pull |

**원칙**

- `docker compose down` 만으로 DB volume 을 삭제하지 않는다 (`down -v` 금지 운영).
- backup·restore runbook 을 deploy 전에 문서화한다.
- VM 스냅샷은 DB 일관성과 별도로 검토한다.

---

## 최소 VM 스펙 (권장 시작점)

소규모 초기 트래픽·단일 인스턴스 기준 **참고값**이다. provider·부하에 따라 조정한다.

| 리소스 | 권장 최소 | 비고 |
|--------|-----------|------|
| vCPU | **2** | api(Gradle JRE) + web(Next.js) + mysql 동시 |
| RAM | **4 GiB** | mysql buffer·JVM heap 여유; 8 GiB 권장 여유 |
| Disk | **40 GiB+** SSD | image layer, mysql volume, log |
| OS | Ubuntu 22.04/24.04 LTS 등 | Docker Engine + Compose plugin |
| Architecture | **amd64** | 현재 CI image 와 일치 |

모니터링 후 CPU/RAM/disk 사용률을 보고 스케일업 또는 managed DB 분리를 검토한다.

---

## env 구조 — managed DB/Redis 분리 대비

single VM 에서 시작해도 **연결 문자열만 env 로 분리**해 두면 이전이 쉽다.

| 변수 | single VM (compose 내부) | managed 이전 후 |
|------|------------------------|-----------------|
| `DB_URL` | `jdbc:mysql://mysql:3306/...` | managed endpoint hostname |
| `SPRING_DATA_REDIS_HOST` | `redis` | managed Redis hostname |
| `DOCKERHUB_USERNAME` / `DASIDA_IMAGE_TAG` | 동일 | 동일 |
| `APP_CORS_ALLOWED_ORIGINS` | `https://example.com` | 동일 |
| `NEXT_PUBLIC_API_URL` | `https://api.example.com` (Web image build) | 동일 |

**이전 순서(개념)**

1. managed MySQL/Redis 프로비저닝·데이터 마이그레이션
2. `.env.prod` 의 `DB_URL` / Redis host 만 변경
3. compose 에서 mysql/redis service 제거(또는 override 삭제)
4. api 재기동·smoke

---

## 배포 순서 (개념, 미실행)

1. VM 프로비저닝, Docker·Nginx 설치
2. 방화벽: 80/443 허용, 나머지 최소화
3. 서버에 `compose.prod.yml` + override(mysql/redis) + `.env.prod` (Git 제외)
4. `docker login` → `docker compose pull` → `up -d`
5. Nginx vhost·TLS ([nginx-reverse-proxy-deployment.md](./nginx-reverse-proxy-deployment.md))
6. Smoke: health, auth, CORS

---

## 향후 작업 TODO

- [ ] VM provider·리전 결정
- [ ] single VM용 compose override 초안 PR (mysql/redis, localhost port bind)
- [ ] MySQL backup/restore runbook
- [ ] host Nginx + TLS runbook
- [ ] `NEXT_PUBLIC_API_URL` / `APP_CORS_ALLOWED_ORIGINS` 확정·주입
- [ ] production deploy runbook
- [ ] managed MySQL/Redis 이전 시점 결정
- [ ] (optional) `linux/arm64` multi-arch build

---

## 관련 문서

- [nginx-reverse-proxy-deployment.md](./nginx-reverse-proxy-deployment.md) — Nginx ingress·TLS·도메인
- [deployment-strategy.md](./deployment-strategy.md) — 배포 후보 비교
- [container-images.md](./container-images.md) — Docker Hub·image pin
- [main-release-readiness.md](./main-release-readiness.md) — deploy 전 체크리스트
- [deploy/compose.prod.example.yml](../../../../deploy/compose.prod.example.yml) — api/web template
- [compose.local.yml](../../../../compose.local.yml) — 로컬 mysql/redis/api/web 참고

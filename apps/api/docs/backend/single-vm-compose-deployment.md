# Single VM Docker Compose 배포 전략

> **상태**: 결정안(문서). **실제 서버·DNS·TLS·deploy·secret 등록은 아직 없음.**  
> secret·credential·실제 도메인·서버 IP 는 이 문서에 적지 않는다.

## 목적

초기 운영을 **VM 1대**에서 시작한다. **Host Nginx**가 public ingress(80/443)를 담당하고, **Docker Compose**가 `web` / `api` / `mysql` / `redis`(Valkey) 를 같은 호스트에서 실행한다.

- 상위 ingress·도메인: [nginx-reverse-proxy-deployment.md](./nginx-reverse-proxy-deployment.md)
- 배포 방식 비교: [deployment-strategy.md](./deployment-strategy.md)
- 현재 [`deploy/compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml) 은 **api/web** base. mysql/redis·localhost bind 는 [`deploy/compose.single-vm.example.yml`](../../../../deploy/compose.single-vm.example.yml) override 로 병행한다.

### 현재 전제 (2026-07-03)

| 항목 | 상태 |
|------|------|
| Docker Hub image | `chorok446/dasida-api|web` — `sha-af5082c` 등 push·smoke 완료 |
| 서버 / VM | **없음** |
| [`compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml) | api/web base template |
| [`compose.single-vm.example.yml`](../../../../deploy/compose.single-vm.example.yml) | mysql/redis override + localhost port bind |
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

### api / web + mysql / redis (compose 병행)

base + override 를 함께 사용한다:

```bash
docker compose \
  -f deploy/compose.prod.example.yml \
  -f deploy/compose.single-vm.example.yml \
  --env-file deploy/.env.prod config

docker compose \
  -f deploy/compose.prod.example.yml \
  -f deploy/compose.single-vm.example.yml \
  --env-file deploy/.env.prod pull

docker compose \
  -f deploy/compose.prod.example.yml \
  -f deploy/compose.single-vm.example.yml \
  --env-file deploy/.env.prod up -d
```

> 위 명령은 **서버 runbook 예시**이다. 저장소 작업·CI 에서 실제 deploy 를 실행하지 않는다.

| 파일 | 역할 |
|------|------|
| [`compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml) | api/web image, healthcheck, 공통 env |
| [`compose.single-vm.example.yml`](../../../../deploy/compose.single-vm.example.yml) | mysql, redis, api/web port·depends_on·internal DB_URL |

### mysql / redis (override)

| Service | Image | 포트 publish | Volume |
|---------|-------|--------------|--------|
| `mysql` | `mysql:8.4` | **없음** | named volume `mysql_data` |
| `redis` | `valkey/valkey:8` | **없음** | (기본 ephemeral; persistence 필요 시 후속) |

**api env (override 가 설정 — compose internal DNS)**

```text
DB_URL=jdbc:mysql://mysql:3306/dasida?useSSL=false&serverTimezone=Asia/Seoul&characterEncoding=utf8
SPRING_DATA_REDIS_HOST=redis
SPRING_DATA_REDIS_PORT=6379
```

[`deploy/.env.prod.example`](../../../../deploy/.env.prod.example): `DB_USER`, `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `SPRING_DATA_REDIS_PASSWORD` 등 placeholder.

> managed DB/Redis 로 이전 시 override 파일 없이 base compose + external `DB_URL` 만 사용한다.

### Nginx · port bind

| Service | Host bind | 외부 인터넷 |
|---------|-----------|-------------|
| Nginx | `:80`, `:443` | 허용 (유일한 public ingress) |
| web | `127.0.0.1:3000` | Nginx 경유만 |
| api | `127.0.0.1:8080` | Nginx 경유만 |
| mysql / redis | (publish 없음) | **차단** |

방화벽: 인터넷 → **80/443 만** 허용. 3000/8080/3306/6379 는 외부 SG 에서 차단.

---

## Volume · backup

| 데이터 | Volume | Backup |
|--------|--------|--------|
| MySQL | `mysql_data` (named volume) | **필수** — dump 스케줄·복구 drill |
| Redis/Valkey | (기본 ephemeral) | rate limit/denylist 위주면 재기동 허용 가능 |
| Container image | stateless | Docker Hub `sha-*` 로 재 pull |

**원칙**

- `docker compose down` 만으로 DB volume 을 삭제하지 않는다 (`down -v` 금지 운영).
- **VM 스냅샷만으로는 충분하지 않다** — MySQL 일관성·point-in-time 복구를 위해 logical backup 필요.
- backup 파일은 **repo·Git에 저장하지 않는다** (서버·object storage 등).
- restore 절차는 **후속 runbook**에서 작성 예정.

**mysqldump 예시 (placeholder, 서버에서만 실행)**

```bash
# 백업 디렉터리는 서버 로컬·비공개 storage — repo 커밋 금지
docker compose -f deploy/compose.prod.example.yml -f deploy/compose.single-vm.example.yml \
  --env-file deploy/.env.prod exec -T mysql \
  mysqldump -u"${DB_USER}" -p"${DB_PASSWORD}" dasida > /path/to/backup/dasida-$(date +%Y%m%d).sql
```

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
3. 서버에 compose 파일 복사 + `.env.prod` (Git 제외), **base + single-vm override** 병행
4. `docker login` → `docker compose pull` → `up -d`
5. Nginx vhost·TLS ([nginx-reverse-proxy-deployment.md](./nginx-reverse-proxy-deployment.md))
6. Smoke: health, auth, CORS

---

## 향후 작업 TODO

- [ ] VM provider·리전 결정
- [x] single VM용 compose override 초안 — [`compose.single-vm.example.yml`](../../../../deploy/compose.single-vm.example.yml)
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
- [deploy/compose.prod.example.yml](../../../../deploy/compose.prod.example.yml) — api/web base template
- [deploy/compose.single-vm.example.yml](../../../../deploy/compose.single-vm.example.yml) — mysql/redis override
- [compose.local.yml](../../../../compose.local.yml) — 로컬 mysql/redis/api/web 참고

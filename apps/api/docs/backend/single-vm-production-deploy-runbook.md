# Single VM production 배포 runbook

> **상태**: runbook(문서). **실제 서버·DNS·TLS·deploy 는 아직 수행하지 않는다.**  
> secret·credential·실제 도메인·서버 IP 는 이 문서에 적지 않는다.

## Purpose

**amd64 VM 1대**에서 **Host Nginx** + **Docker Compose** + **Docker Hub image** 로 Dasida(api/web/mysql/redis)를 배포하는 절차를 정리한다.

| 범위 | 포함 | 제외 |
|------|------|------|
| 플랫폼 | **linux/amd64** VM | 라즈베리파이·ARM 서버·multi-arch |
| ingress | Host Nginx 80/443 | compose 내 Nginx container(후속 선택) |
| data | compose mysql/redis (single VM) | managed DB/Redis 이전 runbook |

관련 전략 문서:

- [single-vm-compose-deployment.md](./single-vm-compose-deployment.md) — 아키텍처·스펙·volume
- [nginx-reverse-proxy-deployment.md](./nginx-reverse-proxy-deployment.md) — Nginx·TLS·도메인·CORS
- [container-images.md](./container-images.md) — Docker Hub·`sha-*` pin

---

## Preconditions

배포 전에 아래가 준비되어야 한다.

| 항목 | 요구 |
|------|------|
| VM | **linux/amd64** (Ubuntu 22.04/24.04 LTS 등 권장) |
| 스펙 | **2 vCPU+**, **4 GiB RAM+** (가능하면 **8 GiB**), **40 GiB+ SSD** |
| 도메인 | Web `example.com`, API `api.example.com` (placeholder — 실제 FQDN 확정 필요) |
| DNS | Web/API A(또는 CNAME) 레코드가 **배포 VM**을 가리켜야 TLS 발급 가능 |
| Docker Hub | `chorok446/dasida-api|web` pull 가능 (private 시 `docker login`) |
| Image tag | **`sha-<shortsha>` pin** (예: `sha-af5082c`). **`main` tag는 운영 pinning 금지** |
| GitHub (Web build) | 운영 API URL 확정 후 `NEXT_PUBLIC_API_URL` Variable + main 재빌드 |
| 라즈베리파이/ARM | **이 runbook 범위 밖** — CI image 는 amd64 전용 |

현재 저장소 상태(2026-07-03):

- Docker Hub push·pull/smoke 완료
- compose template: [`deploy/compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml), [`deploy/compose.single-vm.example.yml`](../../../../deploy/compose.single-vm.example.yml)
- 서버·도메인·TLS·실제 `.env.prod` **없음**
- Web image `NEXT_PUBLIC_API_URL` **placeholder** — API 연동 운영 검증 제한

---

## Server preparation

### OS · 네트워크 (placeholder)

| 항목 | 권장 |
|------|------|
| OS | Ubuntu LTS (예시) |
| Inbound | **80/tcp**, **443/tcp** (public) |
| SSH | **22/tcp** — **관리자 IP 대역으로 제한** (전 세계 개방 비권장) |
| MySQL 3306 | **public open 금지** |
| Redis 6379 | **public open 금지** |
| api/web 8080/3000 | **인터넷 직접 노출 금지** — Nginx 경유, compose 는 `127.0.0.1` bind |

### Deploy path (예시)

```text
/opt/dasida/
```

### 배포 파일 전달 방식 (택 1)

1. **git clone** — 서버에서 repo checkout 후 `deploy/` 파일 복사·이름 변경
2. **파일만 복사** — `compose.prod.example.yml` 등 필요한 파일만 scp/rsync (secret 없이)

어느 방식이든 **`.env.prod` 는 repo에 커밋하지 않는다.**

---

## Docker installation

서버에서 (예시 — 배포 시 실행):

```bash
# Docker Engine + Compose plugin — 배포 담당이 공식 문서에 맞게 설치
# https://docs.docker.com/engine/install/ubuntu/
docker --version
docker compose version
```

Apple Silicon 로컬 검증 시 `--platform linux/amd64` 필요([container-images.md](./container-images.md)). **운영 VM 은 amd64 전제.**

---

## Directory layout

서버 예시 (`/opt/dasida/`):

```text
/opt/dasida/
├── compose.prod.yml          # deploy/compose.prod.example.yml 복사본
├── compose.single-vm.yml     # deploy/compose.single-vm.example.yml 복사본
├── .env.prod                 # deploy/.env.prod.example 복사 후 실제 값 주입 (git 제외)
├── backups/                  # mysqldump 등 (repo·Git 커밋 금지)
└── nginx/                    # vhost 스니펫·certbot webroot (선택)
```

| 파일 | 권한·보관 |
|------|-----------|
| `.env.prod` | **`chmod 600`** 권장. Git·Slack·이슈에 붙여넣기 금지 |
| `backups/` | 서버 로컬 또는 비공개 object storage only |

---

## Production env file

`.env.prod` 항목 ([`deploy/.env.prod.example`](../../../../deploy/.env.prod.example) 참고). **아래는 이름·placeholder 만.**

| 변수 | 용도 | 비고 |
|------|------|------|
| `DOCKERHUB_USERNAME` | Docker Hub namespace | 예: `your-dockerhub-username` |
| `DASIDA_IMAGE_TAG` | image pin | 예: `sha-xxxxxxxx` |
| `NEXT_PUBLIC_API_URL` | Web image **build-time** (참고용 기록) | 예: `https://api.example.com` — **런타임 env 로 변경 불가** |
| `API_INTERNAL_URL` | web 컨테이너 SSR (compose **런타임 env**) | 예: `http://api:8080` — compose 내부 api 서비스 |
| `SPRING_PROFILES_ACTIVE` | Spring profile | `prod` |
| `JWT_SECRET` | JWT 서명 | `replace-with-secret-minimum-32-bytes` |
| `DB_URL` | JDBC (single VM override 가 internal URL 설정) | external 시 managed host |
| `DB_USER` | MySQL 사용자 | `replace-with-user` |
| `DB_PASSWORD` | MySQL 비밀번호 | `replace-with-password` |
| `MYSQL_ROOT_PASSWORD` | MySQL root | `replace-with-root-password` |
| `APP_CORS_ALLOWED_ORIGINS` | API CORS | `https://example.com` |
| `SPRING_DATA_REDIS_HOST` | Redis host | single VM: override 가 `redis` 설정 |
| `SPRING_DATA_REDIS_PORT` | Redis port | `6379` |
| `SPRING_DATA_REDIS_PASSWORD` | Valkey `requirepass` 와 **동일** | `replace-if-used` |

### `NEXT_PUBLIC_API_URL` 주의

1. 운영 API 도메인 확정 → GitHub Repository Variable `NEXT_PUBLIC_API_URL` 등록
2. **main push** 로 Web image 재빌드
3. 해당 **`sha-*` Web image** 로 deploy

**placeholder Web image** 로는 브라우저→API 연동 **운영 검증이 제한**된다.

### `API_INTERNAL_URL` (web SSR)

- web 컨테이너의 Server Components·SSR fetch 전용. compose 내부 `http://api:8080`.
- `127.0.0.1:8080`은 web 컨테이너 loopback 이라 API에 닿지 않는다.
- [`deploy/compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml) web service `environment` 에 주입. 클라이언트 번들에 포함되지 않음.

생성 예 (서버에서만):

```bash
cp deploy/.env.prod.example /opt/dasida/.env.prod
chmod 600 /opt/dasida/.env.prod
# 편집기로 placeholder 를 실제 값으로 교체 — 값을 이 runbook·repo 에 적지 않음
```

---

## Compose config validation

작업 디렉터리: `/opt/dasida` (예시). **파일명은 서버 복사 방식에 따라 다를 수 있다.**

```bash
cd /opt/dasida

docker compose \
  -f compose.prod.yml \
  -f compose.single-vm.yml \
  --env-file .env.prod \
  config
```

확인:

- `api` / `web` image: `${DOCKERHUB_USERNAME}/dasida-*:${DASIDA_IMAGE_TAG}`
- `api` / `web` ports: `127.0.0.1:8080`, `127.0.0.1:3000`
- `mysql` / `redis`: **published port 없음**
- `mysql_data` volume 존재

---

## First deploy

```bash
cd /opt/dasida

# private image 또는 rate limit 회피 시
echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin

docker compose \
  -f compose.prod.yml \
  -f compose.single-vm.yml \
  --env-file .env.prod \
  pull

docker compose \
  -f compose.prod.yml \
  -f compose.single-vm.yml \
  --env-file .env.prod \
  up -d
```

> **이 runbook 작성 시 위 명령은 실행하지 않는다.** 서버 runbook 실행 단계용 예시이다.

기동 순서: mysql/redis healthy → api healthy → web.

---

## Nginx setup

**Host Nginx** 1차 권장 ([nginx-reverse-proxy-deployment.md](./nginx-reverse-proxy-deployment.md)).

| vhost | upstream |
|-------|----------|
| `example.com` | `http://127.0.0.1:3000` |
| `api.example.com` | `http://127.0.0.1:8080` |

필수 header:

- `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`

설치·vhost 예시는 Nginx 문서의 server block 참고. 적용:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## TLS setup

1. DNS 가 VM 을 가리키는지 확인
2. **Let's Encrypt + certbot** (권장) 또는 provider managed TLS
3. HTTP **80** — ACME challenge + HTTPS redirect
4. **자동 갱신** (certbot timer 등) 확인

```bash
# 예시 — 실제 도메인·경로는 환경에 맞게 치환
sudo certbot certonly --webroot -w /var/www/certbot \
  -d example.com -d api.example.com
```

**TLS 적용 전까지 운영 배포 완료로 보지 않는다.**

---

## Smoke tests

배포 후 최소 확인 (placeholder URL):

```bash
cd /opt/dasida
docker compose -f compose.prod.yml -f compose.single-vm.yml ps
docker compose -f compose.prod.yml -f compose.single-vm.yml logs api --tail=100
docker compose -f compose.prod.yml -f compose.single-vm.yml logs web --tail=100

curl -I https://example.com
curl -fsS https://api.example.com/actuator/health
```

| 항목 | 기대 |
|------|------|
| Web | HTTP 200 (또는 Next.js 정상 응답) |
| API health | `{"status":"UP"}` |
| MySQL/Redis public | `ss -lntp` / SG 에서 3306·6379 외부 미노출 |
| Auth smoke | signup/login 등 — 운영 정책에 맞게 **최소** 수행 |

CORS: 브라우저에서 `https://example.com` → `https://api.example.com` 호출 시 `APP_CORS_ALLOWED_ORIGINS` 일치 확인.

---

## Backup

| 대상 | 정책 |
|------|------|
| MySQL `mysql_data` | **필수** — 정기 `mysqldump` |
| Redis | ephemeral 허용 가능(정책에 따름) |
| VM snapshot | **DB 일관성만으로는 불충분** — logical backup 병행 |

```bash
# 서버에서만 — backup 파일은 repo·Git 금지
docker compose -f compose.prod.yml -f compose.single-vm.yml \
  --env-file .env.prod exec -T mysql \
  mysqldump -u"${DB_USER}" -p"${DB_PASSWORD}" dasida \
  > /opt/dasida/backups/dasida-$(date +%Y%m%d-%H%M).sql
```

**restore 절차**는 [mysql-backup-restore-runbook.md](./mysql-backup-restore-runbook.md) 참고.

---

## Rollback

1. 배포 기록에 사용한 **`DASIDA_IMAGE_TAG`** (`sha-*`) 저장
2. 장애 시 `.env.prod` 의 tag 를 **이전 sha** 로 변경
3. 재배포:

```bash
cd /opt/dasida
docker compose -f compose.prod.yml -f compose.single-vm.yml --env-file .env.prod pull
docker compose -f compose.prod.yml -f compose.single-vm.yml --env-file .env.prod up -d
```

| 주의 | 내용 |
|------|------|
| `main` tag | rollback pin 으로 쓰지 않음 |
| Web URL 변경 | 해당 시점 **Web image sha** 도 함께 되돌림 |
| DB schema | 현재 migration 도구 **없음** — rollback 은 **application image** 수준. schema 변경 도입 후 rollback 위험 증가 |

---

## Troubleshooting

| 증상 | 가능 원인 | 조치 |
|------|-----------|------|
| Docker Hub pull 실패 | login 만료·private repo·rate limit | `docker login`, tag 존재 확인 |
| API DB dialect / connection 오류 | `DB_*` 불일치·mysql 미기동 | compose logs mysql, env·healthcheck |
| Redis auth mismatch | `SPRING_DATA_REDIS_PASSWORD` ≠ Valkey `requirepass` | `.env.prod` 일치 확인 |
| CORS 오류 | `APP_CORS_ALLOWED_ORIGINS` ≠ Web origin | `https://example.com` 정확 일치, wildcard 금지 |
| Nginx 502 | api/web 미기동·wrong upstream | `curl 127.0.0.1:8080/actuator/health`, compose ps |
| TLS 발급 실패 | DNS 미전파·80 차단 | DNS·방화벽·certbot 로그 |
| Web API 호출 실패 (placeholder) | `NEXT_PUBLIC_API_URL` 미반영 image | Variable 등록 + main 재빌드 후 redeploy |
| MySQL volume/permission | volume 손상·disk full | `df -h`, volume inspect, backup 복구 |
| disk full / log growth | container log·image layer | `docker system df`, log rotation 정책 |

---

## What this runbook does not do yet

- 실제 **VM 프로비저닝·SSH 접속·DNS·TLS 발급·deploy 실행**
- **GitHub Secrets/Variables** 등록 (`NEXT_PUBLIC_API_URL` 포함)
- **CD workflow** 자동 deploy
- **managed MySQL/Redis** 이전 절차
- **MySQL restore** 상세 runbook — [mysql-backup-restore-runbook.md](./mysql-backup-restore-runbook.md) (문서화 완료)
- **라즈베리파이 / ARM / multi-arch** 빌드·배포
- **DB schema migration** (Flyway/Liquibase) 정책

---

## 관련 문서

- [deployment-strategy.md](./deployment-strategy.md)
- [main-release-readiness.md](./main-release-readiness.md)
- [production-env-values-template.md](./production-env-values-template.md)
- [github-secrets-setup-runbook.md](./github-secrets-setup-runbook.md)
- [deploy/compose.prod.example.yml](../../../../deploy/compose.prod.example.yml)
- [deploy/compose.single-vm.example.yml](../../../../deploy/compose.single-vm.example.yml)
- [mysql-backup-restore-runbook.md](./mysql-backup-restore-runbook.md)
- [deploy/.env.prod.example](../../../../deploy/.env.prod.example)

# Nginx reverse proxy 배포 전략

> **상태**: 결정안(문서). **실제 서버·DNS·TLS·deploy 는 아직 없음.**  
> secret·credential·실제 도메인·서버 IP 는 이 문서에 적지 않는다.

## 목적

[Docker Compose on VM](./deployment-strategy.md) 1차 배포에서 **Nginx**를 public ingress(80/443)로 두고, **Web·API container**는 내부 포트로만 노출하는 운영 구조를 고정한다.

### 현재 전제 (2026-07-03)

| 항목 | 상태 |
|------|------|
| main merge | 완료 (`af5082c`) |
| Docker Hub image | `chorok446/dasida-api|web` — `main`, `sha-af5082c` push·pull/smoke 완료 |
| 서버 / 도메인 / DNS | **없음** |
| 운영 API public URL | **없음** |
| Web image `NEXT_PUBLIC_API_URL` | **placeholder** ([container-images.md](./container-images.md)) |
| CD / 실제 deploy | **미구현** |

---

## 권장 운영 구조

```text
Internet
  ↓
Nginx (host) :80 / :443
  ├─ https://example.com       → web container :3000
  └─ https://api.example.com   → api container :8080
                                    ↓
                               MySQL / Redis (private, public 노출 금지)
```

### 초기 권장

| 항목 | 권장 |
|------|------|
| VM | **1대**로 시작 |
| Public ingress | Nginx **80/443** 만 인터넷에 허용 |
| SSH | **22/tcp** — 관리자 IP 대역으로 제한 권장 (전 세계 개방 비권장) |
| api / web | Docker Compose — [`compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml) (+ single VM 시 [`compose.single-vm.example.yml`](../../../../deploy/compose.single-vm.example.yml)) |
| Nginx | **호스트 설치** 1차 권장. compose service(Nginx container)는 후속 선택지 |
| api/web container port | **`127.0.0.1` bind** (base compose template 기본값) — Nginx upstream `127.0.0.1:3000|8080` |
| DB / Redis | **public 노출 금지** — compose internal 또는 external managed ([single-vm-compose-deployment.md](./single-vm-compose-deployment.md)) |

### Docker Hub image pin

- 배포 시 `sha-<shortsha>` tag 를 pin 한다 (예: `sha-af5082c`).
- `main` tag 는 최신 main 추적용이며 **deploy pinning 용이 아니다** ([container-images.md](./container-images.md)).

---

## 권장 도메인 구조 (placeholder)

실제 도메인은 아직 없다. 아래는 **예시 이름**만 사용한다.

| 역할 | URL (예시) |
|------|------------|
| Web (브라우저) | `https://example.com` |
| API (공개) | `https://api.example.com` |

### 운영 env 관계

| 변수 | 예시 값 | 주입 위치 |
|------|---------|-----------|
| `NEXT_PUBLIC_API_URL` | `https://api.example.com` | GitHub **Repository Variable** → Web image **build arg** |
| `APP_CORS_ALLOWED_ORIGINS` | `https://example.com` | 서버 `.env.prod` / secret manager → API **runtime env** |

**정책**

- Web origin(`https://example.com`)과 API origin(`https://api.example.com`)이 **다르므로** 브라우저 cross-origin 요청에 **CORS 설정 필수** (`APP_CORS_ALLOWED_ORIGINS`)
- CORS **wildcard(`*`) 금지**
- **`localhost` / `127.0.0.1` 금지** (prod)
- trailing slash: base URL 은 **슬래시 없이** 통일 (`https://api.example.com` — 끝에 `/` 없음)
- Web origin 과 `APP_CORS_ALLOWED_ORIGINS` 는 **정확히 일치**해야 한다
- 여러 origin 이 필요하면 comma-separated **명시 allowlist**

### `NEXT_PUBLIC_API_URL` — 현재 보류

- 운영 API 도메인이 **확정되기 전**에는 GitHub Variable 등록·main 재빌드를 **하지 않는다**.
- 현재 main push Web image 는 placeholder 로 bake-in 되어 **API 연동 운영 검증에 부적합**하다.
- 도메인 확정 후: Variable 등록 → main push 로 Web image 재빌드 → 해당 `sha-*` 로 deploy.

### `APP_CORS_ALLOWED_ORIGINS`

- 운영 Web 도메인 확정 후 서버 env 로 주입한다.
- GitHub Secret 또는 서버 전용 `.env.prod` 에만 둔다 — **저장소에 커밋하지 않는다**.

---

## Nginx upstream 구조

| Virtual host | upstream | container |
|--------------|----------|-----------|
| `example.com` | `127.0.0.1:3000` (또는 compose `web:3000`) | Next.js |
| `api.example.com` | `127.0.0.1:8080` (또는 compose `api:8080`) | Spring Boot |

**포트 · compose network**

| 접근 경로 | 권장 upstream | 비고 |
|-----------|---------------|------|
| Host Nginx (초기) | `127.0.0.1:3000` / `127.0.0.1:8080` | base [`compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml) 가 **127.0.0.1 bind** |
| Nginx in compose network (후속) | `http://web:3000` / `http://api:8080` | Nginx container 를 같은 compose stack 에 넣을 때 |

- 방화벽/SG: 인터넷 → **80/443**(및 제한된 **22**)만. **3000/8080/3306/6379** 는 외부에 열지 않는다.
- mysql/redis 는 compose **internal DNS**(`mysql`, `redis`)로만 api 가 접근 ([`compose.single-vm.example.yml`](../../../../deploy/compose.single-vm.example.yml)).

---

## Nginx server block 예시 (placeholder)

아래는 **참고용**이다. 실제 도메인·인증서 경로·서버 IP 는 배포 시 치환한다.

```nginx
# HTTP → HTTPS redirect + ACME challenge (Let's Encrypt)
server {
    listen 80;
    listen [::]:80;
    server_name example.com api.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# Web — https://example.com
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;   # placeholder path
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;     # placeholder path

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # proxy_set_header Upgrade $http_upgrade;  # WebSocket 필요 시 검토
        # proxy_set_header Connection "upgrade";
    }

    # TODO: client_max_body_size — 업로드 정책 확정 후 설정
}

# API — https://api.example.com
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;   # placeholder path
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;     # placeholder path

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # TODO: client_max_body_size — multipart/API payload 정책 확정 후 설정
}
```

---

## TLS 전략

| 방식 | 비고 |
|------|------|
| **Let's Encrypt + certbot** | 1차 **권장**. 무료·자동 갱신 |
| Cloud / provider managed TLS | LB·CDN 앞단에서 종료 시 Nginx 또는 LB 정책에 맞게 선택 |

**원칙**

- 인증서 **자동 갱신** 절차 필요 (certbot timer 또는 provider 정책).
- HTTP **80** 은 ACME challenge 및 HTTPS redirect 용으로 열 수 있다.
- **TLS 적용 전까지 운영 배포 완료로 보지 않는다.**

---

## Spring Boot proxy header 고려사항

Nginx 뒤에서 HTTPS origin 을 애플리케이션이 인식하려면 `X-Forwarded-*` header 전달이 필요하다 (위 server block 예시 참고).

| 항목 | 이번 PR |
|------|---------|
| Nginx `proxy_set_header X-Forwarded-Proto` | 문서화만 |
| Spring Boot `server.forward-headers-strategy` 등 | **변경하지 않음** |
| redirect / cookie / absolute URL 이슈 | 실제 deploy smoke 에서 확인 후 **별도 fix PR** |

배포 smoke 시 확인할 항목(향후):

- HTTP → HTTPS redirect 가 올바른 **public origin** 을 가리키는지
- CORS preflight 가 `APP_CORS_ALLOWED_ORIGINS` 와 일치하는지
- (필요 시) secure cookie / SameSite 정책

---

## Compose template 과의 관계

| 구성 요소 | 역할 |
|-----------|------|
| [`deploy/compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml) | api/web 실행 — `127.0.0.1:3000|8080` publish |
| [`deploy/compose.single-vm.example.yml`](../../../../deploy/compose.single-vm.example.yml) | single VM 시 mysql/redis 추가( internal only ) |
| Host Nginx | public ingress — TLS 종료, vhost 라우팅 |
| External / compose MySQL·Redis | api env `DB_URL` / `SPRING_DATA_REDIS_*` 로 주입 |

**권장**

- Nginx 를 compose service 로 넣는 방식(컨테이너 Nginx)은 **후속 선택지**로만 문서화한다.
- api/web port 를 인터넷에 직접 열지 않는다.
- DB/Redis 는 external managed 또는 VM private network 전제.

**배포 순서(개념)**

1. VM 준비, Docker 설치, Nginx 설치
2. `.env.prod` 작성(서버만), `docker compose pull` / `up -d`
3. Nginx vhost·TLS 설정, `nginx -t` 후 reload
4. smoke: `https://example.com`, `https://api.example.com/actuator/health`

---

## 향후 작업 TODO

- [ ] 실제 도메인 결정 (`example.com` → 운영 FQDN)
- [ ] VM provider 결정
- [ ] host Nginx install vs Nginx container 결정·runbook
- [ ] TLS 발급 방식 결정 (Let's Encrypt vs managed)
- [ ] `NEXT_PUBLIC_API_URL` 등록 + Web image 재빌드 (도메인 확정 후)
- [ ] `APP_CORS_ALLOWED_ORIGINS` 서버 env 준비 (Web 도메인 확정 후)
- [ ] 서버 `.env.prod` 작성 (Git 제외)
- [ ] production deploy runbook 작성 — [single-vm-production-deploy-runbook.md](./single-vm-production-deploy-runbook.md) (문서만)
- [x] compose api/web `127.0.0.1` port bind — [`compose.prod.example.yml`](../../../../deploy/compose.prod.example.yml)
- [ ] (optional) `linux/arm64` multi-arch build
- [ ] (optional) Nginx 를 compose service 로 통합

---

## 관련 문서

- [deployment-strategy.md](./deployment-strategy.md) — Docker Compose on VM 결정안
- [container-images.md](./container-images.md) — Docker Hub·image pin·platform
- [main-release-readiness.md](./main-release-readiness.md) — deploy 전 체크리스트
- [production-env-values-template.md](./production-env-values-template.md) — 운영 값 수집
- [github-secrets-and-environments.md](./github-secrets-and-environments.md) — Secrets/Variables 분류
- [deploy/compose.prod.example.yml](../../../../deploy/compose.prod.example.yml) — api/web compose template
- [deploy/compose.single-vm.example.yml](../../../../deploy/compose.single-vm.example.yml) — single VM mysql/redis override
- [single-vm-compose-deployment.md](./single-vm-compose-deployment.md) — VM 1대 compose 전략

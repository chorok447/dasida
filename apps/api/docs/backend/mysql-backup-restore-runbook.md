# MySQL backup and restore runbook

> **상태**: runbook(문서). **실제 backup/restore·서버 접속·deploy 는 수행하지 않는다.**  
> secret·credential·실제 dump 내용은 이 문서·저장소에 적지 않는다.

## Purpose

[single VM Docker Compose](./single-vm-production-deploy-runbook.md) 운영에서 **MySQL**(`mysql` service, named volume `mysql_data`) 데이터를 **안전하게 백업·복구**하는 절차를 정리한다.

배포 runbook: [single-vm-production-deploy-runbook.md](./single-vm-production-deploy-runbook.md)

---

## Scope

| 포함 | 제외 |
|------|------|
| compose 내부 `mysql:8.4` + `mysql_data` volume | managed MySQL(RDS 등) 전용 runbook |
| logical backup (`mysqldump`) | physical/raw volume snapshot 복제 절차 |
| amd64 VM single-stack | 라즈베리파이/ARM |
| 수동·cron 예시 | backup SaaS·operator 자동화 구현 |

---

## Preconditions

| 항목 | 요구 |
|------|------|
| Stack | `compose.prod.yml` + `compose.single-vm.yml` + `.env.prod` ([deploy runbook](./single-vm-production-deploy-runbook.md)) |
| MySQL service | `docker compose ps` 에 `mysql` **healthy** |
| Env | `DB_USER`, `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD` — `.env.prod` 에만 (Git 제외) |
| Backup dir | 예: `/opt/dasida/backups/mysql/` — repo 밖 |
| 운영 배포 전 | **최소 1회** 수동 backup + restore dry-run 권장 |

---

## Backup policy

| 원칙 | 내용 |
|------|------|
| Named volume | `mysql_data` 는 **반드시** logical backup 대상 |
| VM snapshot | **단독으로는 불충분** — crash-consistent ≠ application-consistent |
| Repo | backup 파일 **Git·저장소 커밋 금지** |
| 오프사이트 | 서버 외부(비공개 storage) 복사 **권장** |

### 최소 정책 예시 (팀에서 조정)

| 항목 | 예시 |
|------|------|
| 정기 dump | **daily** logical dump |
| 보관 | **7~14일** (디스크·규정에 맞게) |
| 배포 전 | **수동 backup** 필수 |
| DB migration 전 | **수동 backup** 필수 (migration 도입 후) |

---

## Manual backup

작업 디렉터리: `/opt/dasida` (예시). compose 파일명은 서버 복사 방식에 따라 다를 수 있다.

### 권장 dump 경로

```text
/opt/dasida/backups/mysql/dasida-YYYYMMDD-HHMMSS.sql.gz
```

### 절차 (서버에서 실행 — **이 PR 작성 시 미실행**)

```bash
cd /opt/dasida
set -a && source .env.prod && set +a

BACKUP_DIR=/opt/dasida/backups/mysql
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="${BACKUP_DIR}/dasida-${STAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

docker compose \
  -f compose.prod.yml \
  -f compose.single-vm.yml \
  --env-file .env.prod \
  exec -T mysql \
  mysqldump \
    --single-transaction \
    --routines \
    --triggers \
    --databases dasida \
    -u"${DB_USER}" \
    -p"${DB_PASSWORD}" \
  | gzip -c > "${OUT}"

chmod 600 "${OUT}"
```

### 주의

- **비밀번호를 명령줄에 직접 적지 않는다** — `.env.prod` source 또는 `docker compose exec` + env 주입. `MYSQL_PWD` 는 shell history·process list 에 노출될 수 있음.
- **root 대신** `DB_USER`(앱 계정) 사용. 전용 backup user 는 **후속 TODO** 권장.
- dump 파일명에 **timestamp** 포함.
- 성공 후 **off-site 복사** 검토.

---

## Scheduled backup

초기에는 **cron** 예시 (systemd timer 도 가능).

### 서버 로컬 스크립트 (template — secret 없음)

`/opt/dasida/scripts/mysql-backup.sh` (예시 골격):

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /opt/dasida
# manual backup 절차와 동일 — 로그는 /opt/dasida/backups/mysql/backup.log 등
```

```cron
# /etc/cron.d/dasida-mysql-backup (예시)
0 3 * * * root /opt/dasida/scripts/mysql-backup.sh >> /var/log/dasida-mysql-backup.log 2>&1
```

| 항목 | 권장 |
|------|------|
| 로그 rotation | `logrotate` 또는 크기 제한 |
| 알림 | 실패 시 Slack/email — **후속 TODO** |
| 스크립트 | repo 에는 **placeholder template** 만; 실제 `.env.prod` 경로는 서버 설정 |

---

## Backup verification

성공 로그만 믿지 않는다.

| 검사 | 명령·기준 |
|------|-----------|
| 파일 존재·크기 | `test -s dasida-*.sql.gz` — **0 bytes 아님** |
| gzip 무결성 | `gzip -t dasida-*.sql.gz` |
| SQL header | `zcat dasida-*.sql.gz \| head -20` — `MySQL dump`, `CREATE DATABASE` 등 |
| (선택) restore dry-run | 임시 MySQL container 또는 `dasida_restore_test` DB 에 import 후 drop |

정기적으로 **분기 1회** restore drill 권장.

---

## Restore procedure

**데이터 파괴 작업** — 운영 창·담당자 확인 후 진행.

### 1. Restore 전

1. **현재 DB 상태 backup** (rollback 용)
2. **app 중지** 또는 maintenance — api 트래픽 차단

```bash
cd /opt/dasida
docker compose -f compose.prod.yml -f compose.single-vm.yml --env-file .env.prod stop api web
```

### 2. 대상 확인

- 복구할 dump 파일 경로·timestamp 확인
- **DB 이름** `dasida` 확인

### 3. Import (예시 — **미실행**)

```bash
set -a && source .env.prod && set +a
DUMP=/opt/dasida/backups/mysql/dasida-YYYYMMDD-HHMMSS.sql.gz

# 기존 데이터 덮어쓰기 주의 — drop/recreate 가 dump 에 포함될 수 있음
zcat "${DUMP}" | docker compose \
  -f compose.prod.yml \
  -f compose.single-vm.yml \
  --env-file .env.prod \
  exec -T mysql \
  mysql -u"${DB_USER}" -p"${DB_PASSWORD}" dasida
```

root 가 필요한 경우만 `MYSQL_ROOT_PASSWORD` 사용 — 일상은 `DB_USER` 권한 범위 내에서.

### 4. Restore 후

```bash
docker compose -f compose.prod.yml -f compose.single-vm.yml --env-file .env.prod up -d
curl -fsS https://api.example.com/actuator/health
# signup/login 등 최소 smoke
```

### 5. 실패 시

- import 중단 → **사전 backup** 으로 재시도 또는 maintenance 유지
- 원인 로그: `docker compose logs mysql --tail=200`
- 복구 불가 시 **off-site backup** 으로 재시도

---

## Rollback relationship

| 작업 | DB data 영향 |
|------|----------------|
| **Image rollback** (`DASIDA_IMAGE_TAG` → 이전 `sha-*`) | **없음** — application binary 만 |
| **DB restore** | **있음** — logical dump 시점으로 되돌림 |
| **VM snapshot revert** | 불확실 — MySQL consistency 보장 어려움 |

- 단순 image rollback **만으로** schema/data 는 되돌아가지 **않는다**.
- Flyway/Liquibase 등 **DB migration 도입 후** 배포 전 backup **필수**.
- 현재 repo: JPA `ddl-auto` 정책 — migration 도구 **없음** (이번 PR 범위 아님).

---

## Storage and retention

| 항목 | 권장 |
|------|------|
| 로컬 경로 | `/opt/dasida/backups/mysql/` |
| 권한 | 디렉터리 `700`, 파일 `600` |
| 보관 | 7~14일 + off-site |
| 삭제 | `find ... -mtime +14 -delete` 등 (cron) — **복사 완료 후** |
| 용량 | `df -h`, backup 디렉터리 모니터링 |

---

## Security notes

- DB password 를 **shell history**·이슈·Slack 에 남기지 않음
- dump 에 **개인정보·민감정보** 포함 — backup 을 public 경로에 두지 않음
- **public web directory** (`/var/www/html` 등) 에 backup 저장 **금지**
- off-site 전송 시 **암호화**(provider SSE, gpg 등) 권장
- backup 파일 접근: deploy 담당·DBA 최소 인원

---

## Troubleshooting

| 증상 | 가능 원인 | 조치 |
|------|-----------|------|
| `Access denied` (mysqldump) | `DB_USER` 권한·비밀번호 불일치 | `.env.prod`, MySQL user grants |
| `No space left on device` | disk full | `df -h`, 오래된 backup 삭제, volume 확장 |
| `gzip: invalid data` / broken pipe | dump 중단·disk full | 재실행, `gzip -t` |
| MySQL container not running | compose down·crash | `docker compose ps`, `logs mysql` |
| Restore FK constraint | dump 순서·partial import | `--single-transaction` dump 사용, 전체 dump 재import |
| charset/collation | dump·server default 불일치 | dump 시 `--default-character-set=utf8mb4` 검토 (후속) |
| Permission denied (파일) | backup dir 권한 | `chmod 700`, 실행 user |
| disk full (점진) | log·image layer·backup 누적 | `docker system df`, retention 정책 |

---

## What this runbook does not do yet

- 실제 **backup/restore 실행**·서버 SSH
- **managed MySQL** backup/PITR
- backup **알림·모니터링** 자동화
- **backup 전용 DB user** 생성 runbook
- **encrypted off-site** 업로드 스크립트 (repo template 만 가능)
- **DB schema migration** 정책

---

## 관련 문서

- [single-vm-production-deploy-runbook.md](./single-vm-production-deploy-runbook.md)
- [single-vm-production-deploy-runbook.md](./single-vm-production-deploy-runbook.md)
- [main-release-readiness.md](./main-release-readiness.md)
- [deployment-strategy.md](./deployment-strategy.md)
- [deploy/compose.single-vm.example.yml](../../../../deploy/compose.single-vm.example.yml)

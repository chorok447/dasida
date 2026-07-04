# Backend 문서 인덱스

백엔드·배포 관련 문서의 시작점. **릴리스/배포 전이라면 [main-release-readiness.md](./main-release-readiness.md) 체크리스트부터 본다.**

## 배포 / 운영

| 문서 | 내용 |
|------|------|
| [main-release-readiness.md](./main-release-readiness.md) | main merge·deploy 전 체크리스트 (허브) |
| [deployment-strategy.md](./deployment-strategy.md) | 배포 방식 비교·1차 결정(Compose on VM) |
| [single-vm-production-deploy-runbook.md](./single-vm-production-deploy-runbook.md) | single VM 아키텍처 + 배포 runbook |
| [nginx-reverse-proxy-deployment.md](./nginx-reverse-proxy-deployment.md) | Host Nginx ingress·TLS·도메인 |
| [container-images.md](./container-images.md) | Docker Hub image·tag·CI 정책 |
| [mysql-backup-restore-runbook.md](./mysql-backup-restore-runbook.md) | MySQL backup/restore runbook |
| [github-secrets-and-environments.md](./github-secrets-and-environments.md) | GitHub Secrets/Variables/Environment 정책 + 생성 runbook |
| [production-env-values-template.md](./production-env-values-template.md) | 운영 값 수집·검증 체크리스트 |

## 보안 / 인증 정책

| 문서 | 내용 |
|------|------|
| [redis-security-store-policy.md](./redis-security-store-policy.md) | rate limit / logout denylist store 정책 |
| [auth-token-revocation.md](./auth-token-revocation.md) | 토큰 무효화(denylist) 설계 배경 |

## 검증 기록 (아카이브)

| 문서 | 내용 |
|------|------|
| [spring-boot-4-1-migration-check.md](./spring-boot-4-1-migration-check.md) | Boot 3.5 → 4.1 마이그레이션 검증 (PR #121, 완료) |
| [openapi-nullability-contract-check.md](./openapi-nullability-contract-check.md) | Boot 4.1 후 OpenAPI 계약 diff 검증 (완료) |

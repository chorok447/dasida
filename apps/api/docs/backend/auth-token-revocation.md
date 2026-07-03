# Auth 토큰 무효화(denylist) 도입 계획

> 상태: **구현 완료**. logout access token denylist 가 도입되어 있다(hash 기반, 아래 후보 A 계열). 실제 현재 동작·API 계약은 [apps/api/README.md 의 "로그아웃과 토큰 무효화(denylist)"](../../README.md#로그아웃과-토큰-무효화denylist) 와 [Redis 보안 store 운영 정책](./redis-security-store-policy.md) 을 참조한다.
>
> 아래 4~9절은 도입 검토 시점의 **설계 기록**이다(원본 토큰 대신 SHA-256 hash 를 key 로 쓰는 방식으로 구현됐다). refresh token 은 지금도 도입하지 않았다.

## 1. 현재 인증 구조 요약

Dasida API 는 **stateless JWT 단일 access token** 방식이다. 서버는 세션을 저장하지 않는다.

- **발급**: `POST /api/auth/signup`, `POST /api/auth/login` → `AuthService` → `JwtService.issue(user)`.
  - claim: `sub`(userId), `name`, `verified`, `iat`, `exp`.
  - 서명: HMAC-SHA(jjwt), 키는 `app.jwt.secret`(`JWT_SECRET`, 최소 32바이트).
- **TTL**: `app.jwt.ttl-millis`(`JWT_TTL_MS`, 기본 `86400000` = 24시간). 만료 전에는 서버가 개별 토큰을 무효화할 수단이 없다.
- **검증**: `JwtAuthFilter` 가 `Authorization: Bearer <jwt>` 를 파싱한다.
  1. 서명·만료(`exp`) 검증(`JwtService.parse`).
  2. DB 에서 사용자 조회 → 사용자가 없거나 `deletedAt != null` 이면 401.
  3. 통과 시 `SecurityContext` 에 `ROLE_USER` 인증 주입.
- **토큰 재발급 지점**: `updateProfile`, `changePassword`, `changeEmail` 성공 시 새 토큰을 응답에 담아 반환한다. 단, **기존(이전) 토큰은 만료 전까지 여전히 유효**하다.
- **프론트엔드 보관**: 토큰을 `localStorage`(`dasida.token`)에 저장. `apps/web/src/lib/auth.ts`.
- **정책 경로**: 모든 `GET /api/**` public, `POST /api/auth/**` public, 그 외 mutation·마이페이지·알림·신고 등은 `authenticated()`(`SecurityConfig`).

관련 파일:
- `security/JwtService.kt` — 발급/파싱
- `security/JwtAuthFilter.kt` — 요청별 검증
- `security/SecurityConfig.kt` — 경로별 인가 정책(stateless)
- `auth/AuthService.kt`, `auth/AuthController.kt` — signup/login/계정 관리

## 2. refresh token 존재 여부

**없다(현재도).** 소스에 refresh token 개념·엔드포인트·claim·저장소가 없다. access token 하나만 발급·사용하며, 재발급은 재로그인으로 한다.

## 3. logout 엔드포인트 (구현됨)

> 도입 검토 시점에는 **없었다**(로그아웃이 프론트엔드의 `localStorage` 삭제뿐이라 서버는 토큰을 만료까지 유효로 취급). 이후 아래처럼 **구현됨**.

- **`POST /api/auth/logout`** (bearerAuth): 현재 access token 의 SHA-256 hash 를 남은 만료 시간까지 denylist 에 등록. 성공 시 `200 { "loggedOut": true }`.
- 로그아웃 후 같은 access token 재사용, 토큰 없음/깨진 토큰/denylisted 토큰은 모두 `401`.
- 코드: `auth/AuthController.logout`, `auth/AuthService.logout`, `security/TokenDenylistStore`, `security/JwtAuthFilter`.
- API 계약·denylist 요약은 [README](../../README.md#로그아웃과-토큰-무효화denylist), 운영/장애 정책은 [Redis 보안 store 운영 정책](./redis-security-store-policy.md) 참조.

## 4. denylist(무효화)가 필요한 이유

stateless JWT 는 만료 전 개별 무효화가 구조적으로 불가능하다. 현재 부분적 완화책과 공백은 다음과 같다.

| 시나리오 | 현재 동작 | 공백 |
|---|---|---|
| 계정 탈퇴 | `JwtAuthFilter` 가 `deletedAt` 확인 → 즉시 401 | 없음(DB 확인으로 이미 무효화됨) |
| 비밀번호 변경 | 새 토큰 재발급 | **이전 토큰이 만료까지 유효** |
| 이메일 변경 | 새 토큰 재발급 | **이전 토큰이 만료까지 유효** |
| 명시적 로그아웃 | 클라이언트 토큰 삭제만 | **서버에서 토큰이 여전히 유효** |
| 토큰 유출/탈취 | 없음 | **최대 24시간 노출** |
| 관리자 강제 로그아웃/차단 | 없음(탈퇴 외) | 강제 무효화 수단 없음 |

즉 denylist 는 **"아직 만료되지 않은 access token 을 서버가 즉시 무효화"** 하기 위한 것이다. 대표 트리거: 로그아웃, 비밀번호 변경, 관리자 차단, 유출 대응.

## 5. Redis/Valkey 기반 denylist 후보 구조

Redis-compatible store(Valkey 8)는 이미 rate limit 용으로 도입되어 있다. 이를 denylist 저장소로 재사용하는 것이 가장 자연스럽다.

- **현재 Redis 사용 지점**: `common/ratelimit/RedisRateLimitBucketStore`(`StringRedisTemplate`). `@ConditionalOnProperty(app.rate-limit.store=redis)` 로 활성화.
- **활성 프로파일**: `local` 프로파일(`compose.local.yml` 의 Valkey)에서만 Redis 연결. 기본/테스트 기동은 in-memory + `management.health.redis.enabled=false`.
- **prod 제약**: `application-prod.yml` 에 **Redis 설정이 아직 없다**. denylist 를 prod 에서 쓰려면 prod Redis/Valkey 인프라 provisioning 이 선행되어야 한다(이 문서 범위 밖, 별도 인프라 작업).

### 후보 A — JTI blocklist (개별 토큰 무효화)

- 발급 시 토큰에 `jti`(고유 ID) claim 추가.
- 무효화 시 `denylist:jwt:jti:{jti}` 키를 남은 TTL 만큼 저장.
- `JwtAuthFilter` 가 서명·DB 확인 후 해당 키 존재 여부를 조회 → 존재하면 401.
- 장점: 특정 토큰만 정밀 무효화(단일 기기 로그아웃).
- 단점: `jti` claim 추가 = **JWT claim 구조 변경**(현재 범위에서 금지). 요청마다 Redis 조회 1회 추가.

### 후보 B — user token epoch / "not-before" (사용자 단위 일괄 무효화)

- `denylist:jwt:user:{userId}` 에 무효화 기준 시각(예: epoch millis)을 저장.
- `JwtAuthFilter` 가 토큰 `iat` 와 비교 → `iat < 기준시각` 이면 401.
- 로그아웃/비밀번호 변경 시 해당 키를 "지금" 으로 갱신 → 그 이전 발급 토큰 전부 무효화.
- 장점: claim 구조 변경 불필요(`iat` 는 이미 존재), "모든 기기 로그아웃"·비밀번호 변경 대응에 적합.
- 단점: 사용자 단위라 특정 기기 하나만 남기고 로그아웃하는 정밀 제어는 불가.

> **권장 방향**: claim 구조를 건드리지 않는 **후보 B(user epoch)** 를 1차 도입안으로 본다. 정밀 단일 토큰 무효화가 실제 필요해지면 그때 `jti`(후보 A)를 별도 PR 로 추가한다. (YAGNI)

## 6. key naming 후보

기존 rate limit 키(`rate-limit:auth:login:ip:{clientIp}`) 컨벤션(`:` 구분, prefix namespace)을 따른다.

- 후보 A(JTI): `denylist:jwt:jti:{jti}` → value 는 placeholder(`"1"`), TTL 로 자동 소멸.
- 후보 B(user epoch): `denylist:jwt:user:{userId}` → value 는 무효화 기준 epoch millis.
- prefix 는 `denylist:jwt:` 로 통일해 rate limit(`rate-limit:`)과 네임스페이스를 분리한다.

## 7. TTL 처리 방식 후보

denylist 항목은 **원본 토큰이 어차피 만료되는 시점 이후로는 남길 필요가 없다.** Redis TTL 로 자동 정리한다.

- 후보 A(JTI): 무효화 시점에 `토큰 exp - now` 를 TTL 로 설정(`SET key 1 EX <remaining>`). rate limit 의 `expire()` 패턴과 동일.
- 후보 B(user epoch): 키 TTL 을 `app.jwt.ttl-millis`(access token 최대 수명)로 설정. 기준시각보다 오래된 토큰은 어차피 `exp` 로도 만료되므로, 마지막 무효화 후 TTL 이 지나면 키를 지워도 안전하다. 무효화가 갱신될 때마다 TTL 도 갱신.
- 공통: TTL 을 두어 denylist 가 무한정 커지지 않도록 한다. 별도 배치 정리 불필요.

## 8. logout / refresh 엔드포인트 필요 여부

| 엔드포인트 | 필요성 | 비고 |
|---|---|---|
| `POST /api/auth/logout` | denylist 도입의 핵심 트리거. 필요. | 현재 토큰(또는 사용자)의 무효화 항목을 기록. `authenticated()` 경로로 추가. |
| `POST /api/auth/refresh` | **denylist 자체에는 불필요.** | refresh token 을 함께 도입할지는 별개 결정. 짧은 access TTL + refresh 로 전환하면 무효화 대상 노출 창이 줄지만, 이는 refresh token 도입이라는 더 큰 변경이며 이 문서 범위 밖이다. |

- **denylist 만 도입** 하는 최소 범위에서는 `logout` 엔드포인트 1개면 충분하다.
- 비밀번호/이메일 변경은 기존 엔드포인트 내부에서 무효화 항목을 추가로 기록하는 방식(엔드포인트 신설 불필요).
- refresh token 은 "access TTL 을 짧게 줄이고 싶을 때" 별도 설계·PR 로 다룬다. 현재 24시간 TTL 을 유지하는 한 denylist 단독으로 로그아웃/유출 대응이 가능하다.

## 9. 구현 시 필요한 테스트 목록

기존 회귀 테스트 스타일(`AuthRateLimitTest`, `JwtServiceTest`, `RedisCompatibleStoreConnectionTest`)을 따른다.

- **denylist store**
  - 무효화 항목 저장 후 조회 시 차단됨.
  - TTL 만료 후 항목이 사라지면 다시 통과.
  - in-memory / redis store 양쪽 동작 동일(rate limit 의 `@ConditionalOnProperty` 이중 구현 패턴 재사용 시).
- **JwtAuthFilter 통합**
  - denylist 에 오른 토큰(또는 기준시각 이전 발급 토큰) → 401.
  - denylist 에 없는 정상 토큰 → 통과.
  - denylist 조회는 서명·DB 확인 이후에만 수행(무효 토큰이 Redis 를 때리지 않도록).
- **logout 엔드포인트**
  - 로그아웃 후 같은 토큰으로 인증 필요 API 호출 시 401.
  - 미인증 상태 로그아웃 요청 처리(401 또는 idempotent no-op — 정책 확정 필요).
- **비밀번호/이메일 변경 연동**(후보 B 채택 시)
  - 변경 성공 후 이전 토큰 무효화, 새 토큰은 통과.
- **store 미가용 시 fallback**
  - Redis 다운 시 인증 자체가 막히지 않도록 하는 정책(fail-open vs fail-closed) 결정 및 검증.

## 10. 구현 시 건드리면 안 되는 범위

- **JWT claim 구조**: 후보 B 는 claim 변경이 필요 없다. 후보 A(`jti`)를 도입하면 claim 이 바뀌므로 별도 결정·PR 로 분리한다.
- **SecurityConfig 인가 정책**: 기존 경로별 permitAll/authenticated 규칙을 바꾸지 않는다. logout 은 `authenticated()` 경로로 **추가**만 한다.
- **stateless 세션 정책**: `SessionCreationPolicy.STATELESS` 유지. denylist 는 세션이 아니라 무효화 목록이다.
- **DB schema/entity/repository**: denylist 는 Redis 에 둔다. `User` 엔티티에 컬럼을 추가하지 않는다.
- **rate limit 코드**: `common/ratelimit/*` 의 store 를 재사용하더라도 rate limit 동작·키·정책은 변경하지 않는다. denylist 는 별도 컴포넌트로 분리한다.
- **prod 보안 설정**: CORS/OpenAPI/Actuator/JWT secret 가드(`application-prod.yml`, `CorsProperties`, `JwtService` init guard)를 변경하지 않는다.
- **TTL 기본값·JWT_SECRET 주입 방식**: `app.jwt.*` 기존 property 를 바꾸지 않는다.
- **프론트엔드**: 이 계획은 백엔드 무효화 저장소가 대상이다. 프론트 토큰 저장 방식(`localStorage`) 변경은 별개 논의.

## 선행 조건 요약

1. **prod Redis/Valkey provisioning** — 현재 prod 에 Redis 설정이 없다. denylist 를 prod 에 적용하려면 인프라 준비가 선행되어야 한다.
2. **fail-open/closed 정책 결정** — Redis 장애 시 인증을 통과시킬지(fail-open) 막을지(fail-closed).
3. **무효화 트리거 범위 확정** — 로그아웃만인지, 비밀번호/이메일 변경까지 포함할지.

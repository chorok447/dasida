# Redis/Valkey 기반 보안 store 운영 정책

> 상태: **운영 정책 정리(초안)**. 현재 구현된 동작과, 아직 결정되지 않은 운영 정책(장애 시 fail 정책, prod 적용)을 구분해 정리한다. 이 문서는 코드/설정을 바꾸지 않으며, prod Redis 도입 전 결정·구현 PR 로 넘길 항목을 모은다.
>
> 관련 문서: [rate limit 정책](../../README.md#rate-limit)(`apps/api/README.md`), [logout denylist 도입 계획](./auth-token-revocation.md).

## 1. Redis/Valkey 를 사용하는 기능

현재 Redis-compatible store(compose local 은 Valkey 8)를 쓰는 기능은 다음과 같다. 두 기능 모두 store 를 프로파일별로 in-memory ↔ redis 로 전환한다(같은 `@ConditionalOnProperty` 패턴).

| 기능 | 목적 | store 토글 property | 코드 |
|---|---|---|---|
| auth rate limit (login/signup) | 로그인·회원가입 IP 기준 fixed-window 제한 | `app.rate-limit.store` | `common/ratelimit/*`, `AuthRateLimitFilter` |
| content write rate limit (comment/report) | 댓글·신고 작성 IP 기준 fixed-window 제한 | `app.rate-limit.store` | `common/ratelimit/*`, `ContentWriteRateLimitFilter` |
| logout denylist (access token) | 로그아웃된 access token 을 만료 전까지 차단 | `app.auth.denylist.store` | `security/TokenDenylistStore`, `JwtAuthFilter` |

## 2. 현재 store 동작(프로파일별)

| 환경 | rate limit store | denylist store | Redis 연결 | 근거 |
|---|---|---|---|---|
| 기본(호스트 `bootRun`) / test | `memory` | `memory` | 없음(`management.health.redis.enabled=false`) | `application.properties`, `src/test/resources/application.properties` |
| compose local (`SPRING_PROFILES_ACTIVE=local`) | `redis` | `redis` | Valkey (`compose.local.yml` 의 `redis` 서비스) | `application-local.properties` |
| **prod** | (미설정 → 기본 `memory`) | (미설정 → 기본 `memory`) | **없음** | `application-prod.yml` 에 store/redis 설정 없음 |

- **핵심**: prod 는 아직 Redis store 를 적용하지 않았다. 현재 prod 로 기동하면 두 기능 모두 **in-memory** 로 동작한다.
- in-memory store 의 한계(prod 다중 인스턴스 기준):
  - **인스턴스 로컬**: rate limit 버킷·denylist 가 인스턴스마다 따로 존재한다. 여러 replica 뒤에 LB 가 있으면 제한/무효화가 인스턴스 간 공유되지 않는다.
  - **재기동 시 소실**: 프로세스 재시작하면 denylist 가 비워져 로그아웃했던 토큰이 만료 전이면 다시 통과할 수 있다.
  - 즉 prod 다중 인스턴스에서 denylist·rate limit 을 신뢰하려면 **공유 Redis store 가 사실상 필수**다.

## 3. key namespace

`:` 구분 prefix 컨벤션. rate limit 과 denylist 는 prefix 로 네임스페이스가 분리되어 공존한다(`{clientIp}`·`{tokenHash}` 는 런타임 값).

| 기능 | key |
|---|---|
| login rate limit | `rate-limit:auth:login:ip:{clientIp}` |
| signup rate limit | `rate-limit:auth:signup:ip:{clientIp}` |
| comment 작성 rate limit (post·campaign 공유 버킷) | `rate-limit:comment:create:ip:{clientIp}` |
| report 작성 rate limit | `rate-limit:report:create:ip:{clientIp}` |
| logout denylist | `denylist:jwt:access:sha256:{tokenHash}` |

- denylist value 는 placeholder(`"1"`), 원본 JWT 는 저장하지 않는다(SHA-256 hash 만 key 로 사용).
- TTL: rate limit key 는 window(기본 60초), denylist key 는 토큰 남은 만료 시간까지. 둘 다 Redis TTL 로 자동 소멸(별도 정리 배치 불필요).

## 4. 장애(Redis 다운) 시 정책

### 4-1. 현재 de-facto 동작(의도된 정책이 아니라 코드 결과)

- **rate limit**: `AuthRateLimitFilter`/`ContentWriteRateLimitFilter` 는 `RateLimitExceededException` 만 catch 한다. Redis 연결 실패 등 다른 예외는 catch 되지 않아 **요청이 5xx 로 실패**한다. → 명시적 fail-open 이 **없다**(장애 시 해당 mutation 이 막힘).
- **denylist**: `JwtAuthFilter` 는 파싱·denylist·DB 조회를 하나의 `try { ... } catch (_: Exception)` 로 감싸고, 예외 시 **401** 로 처리한다. Redis 실패 시 `isDenied` 예외 → Bearer 토큰 요청이 전부 **401**(사실상 fail-closed, 단 "모든 인증 사용자 거절"이라는 부작용). 토큰 없는 public GET 은 영향 없음.

즉 현재는 **두 기능 모두 장애 시 사실상 fail-closed(요청 실패)** 이며, 이는 설계된 정책이 아니라 예외 처리의 결과다. prod 적용 전에 의도적으로 정해야 한다.

### 4-2. 정책 후보와 장단점

**rate limit — 권장: fail-open**

| 후보 | 장점 | 단점 |
|---|---|---|
| fail-open (store 오류 시 통과 허용) | 가용성 우선. Redis 장애가 로그인·작성 전면 차단으로 번지지 않음 | 장애 동안 제한이 사라져 brute-force/스팸에 노출 |
| fail-closed (현재 de-facto, 오류 시 요청 실패) | 장애 중에도 남용 차단 | Redis 장애 = 로그인/작성 장애로 전파(가용성 악화) |

> rate limit 은 남용 완화가 목적이고 인증/인가의 최종 방어선이 아니므로 **fail-open** 을 권장. 단 장애 로그·알럿으로 무제한 구간을 관측 가능해야 한다.

**logout denylist — 권장: fail-closed(+ degraded-mode 명시)**

| 후보 | 장점 | 단점 |
|---|---|---|
| fail-closed (store 확인 불가 시 인증 거절) | 무효화됐을 수 있는 토큰을 통과시키지 않음(보안 우선) | Redis 장애 = 전 사용자 인증 불가(가용성 급락) |
| fail-open (store 확인 불가 시 denylist 무시하고 통과) | 가용성 우선 | 로그아웃/유출 토큰이 장애 동안 되살아남(보안 목적 무력화) |
| degraded-mode(명시적) | 장애 시 동작을 의도적으로 선택·노출 | 별도 구현·플래그 필요 |

> denylist 는 보안 목적이므로 **fail-closed** 가 기본 권장. 다만 "Redis 장애 = 로그인 사용자 전체 401" 은 가용성 리스크가 크므로, 현재의 우발적 fail-closed 를 그대로 두지 말고 **의도적 degraded-mode**(예: denylist 확인 실패를 구분해 로깅·알럿하고, 정책 플래그로 fail-open/closed 선택 가능)로 명시하는 것을 권장한다. 정책은 서비스 위험도(토큰 TTL 24시간, 유출 리스크)에 따라 결정.

## 5. prod 적용 전 필수 결정 사항

1. **Redis/Valkey provisioning** — prod 용 관리형/자체 호스팅 인스턴스, 가용성(단일/replica/cluster), 용량 산정. `application-prod.yml` 에 `spring.data.redis.*` + `app.rate-limit.store=redis` + `app.auth.denylist.store=redis` 주입(이 문서 범위 밖, 구현 PR).
2. **접속 보안** — TLS 사용 여부, AUTH(비밀번호)/ACL, 접속 정보의 secret manager/환경변수 주입(저장소 커밋 금지). 네트워크 격리(VPC/보안그룹).
3. **장애 시 정책 확정** — 4-2 의 rate limit fail-open / denylist fail-closed(또는 degraded-mode) 를 코드로 구현하고 회귀 테스트 추가.
4. **observability** — store 오류/타임아웃 메트릭, denylist 확인 실패·rate limit 무제한 구간 로깅, 알럿 임계값. (health 응답에 상세 노출은 하지 않는 기존 정책 유지.)
5. **key TTL 검증** — denylist key TTL = 토큰 남은 만료, rate limit key TTL = window. prod 에서도 자동 소멸이 동작하고 키가 무한 증식하지 않는지 확인(대량 로그아웃/트래픽 시 메모리 사용량 포함).
6. **성능/영향 범위** — 인증 요청마다 denylist 조회 1회 추가, rate limit 대상 mutation 마다 store 왕복 1회. Redis latency 가 인증/작성 경로 지연에 미치는 영향 확인.

## 6. 구현 PR 로 넘길 TODO

- [ ] `application-prod.yml` 에 Redis 접속 + store=redis 설정 추가(secret 주입 방식 포함).
- [ ] rate limit store 오류 시 **fail-open** 처리(store 예외를 필터에서 잡아 통과 + 로깅) 및 테스트.
- [ ] denylist store 오류 시 **fail-closed / degraded-mode** 정책 구현(우발적 catch-all 대신 의도적 처리) 및 테스트.
- [ ] store 오류·denylist miss/hit·rate limit 무제한 구간 로깅/메트릭/알럿 추가.
- [ ] prod Redis 연결 smoke/health 확인 절차 문서화(기존 `RedisCompatibleStoreConnectionTest` 참고).
- [ ] TLS/AUTH/네트워크 격리 등 접속 보안 설정 및 문서화.

## 변경하지 않은 것(이 문서 작업 범위)

- 코드/설정/테스트 변경 없음. `application*.properties`, `application-prod.yml` 미변경.
- prod Redis 설정 추가하지 않음(TODO 로만 기술).
- 장애 시 fail-open/closed 미구현(후보·권장안만 정리).
- SecurityConfig/CORS/OpenAPI/Actuator, JWT claim, DB schema 미변경.

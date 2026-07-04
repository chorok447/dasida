# OpenAPI nullable 계약 변화 검증 (Boot 4.1 post-merge)

> 목적: PR #121 merge 이후 **Boot 4.1 + springdoc 3.0.3 + Jackson 3** 상태의 `/v3/api-docs`가
> API 계약 또는 프론트 codegen 에 영향을 주는지 검증한다. **문서/분석 only** — DTO·endpoint·정책 변경 없음.

## 검증 기준

| 항목 | 값 |
| --- | --- |
| develop HEAD (Boot 4.1) | `f1874e6` (PR #121 merge) |
| Boot 3.5 비교 기준 | `ead3ecd` (PR #121 merge 직전, worktree `Dasida-boot35`) |
| PR #122 | **OPEN** (runtime smoke 문서, 이번 작업에서 merge 안 함) |
| PR #113 | **미처리** (`minimumReleaseAge` 보류 유지) |
| 수집 profile | `local` (`bootRun` + `curl /v3/api-docs`) |
| 수집 일자 | 2026-07-02 |

## OpenAPI 수집 방법

```bash
cd apps/api
./gradlew bootRun --args='--spring.profiles.active=local' --no-daemon
# 별도 터미널
mkdir -p docs/backend/openapi-snapshots
curl -s http://localhost:8080/v3/api-docs > docs/backend/openapi-snapshots/openapi-boot-4.1.json
```

Boot 3.5 비교는 merge 직전 commit worktree 에서 동일 절차로 `openapi-boot-3.5.json` 수집.

### snapshot 커밋 여부

- **커밋하지 않음.** (`docs/backend/openapi-snapshots/.gitignore` 에 `*.json` 제외)
- 이유: 파일당 ~40KB, `servers.url` 에 `http://localhost:8080` 포함(민감 secret 은 없으나 재생성 가능).
- 민감 패턴 검사(`jdbc:`, `mysql://`, `jwt_secret`, `dev-insecure`) **음성**.
- 스키마 `password` 필드명·example(`Password1!`) 은 API 계약 설명이며 실제 credential 아님.
- 분석 요약은 본 문서에만 기록하고, snapshot 은 로컬 재수집 정책.

## 요약 결론

| 판단 | 내용 |
| --- | --- |
| **계약 변화** | endpoint path·request required·response required·Page 구조·security scheme **변화 없음** |
| **`nullable: true` 0건** | Boot 3.5·4.1 **모두 0건** — regression 이 아니라 **OpenAPI 3.1 표현 방식** 이슈 |
| **실제 차이** | Boot 4.1 에서 Kotlin nullable 10개 필드가 `type: ["T","null"]` union 으로 표현 (Boot 3.5 는 `type: T` 만, `required` 에도 없음) |
| **codegen 영향** | **낮음~중간**. 현재 `apps/web` 에 OpenAPI codegen 설정 **없음**. 도입 시 union nullable 타입 주의 |
| **후속 조치** | **필수 변경 없음**. codegen 도입 시 Boot 4.1 snapshot 기준으로 optional/nullable 매핑 정책만 문서화 권장 |

---

## Boot 4.1 단독 분석 (`openapi-boot-4.1.json`)

| 항목 | 값 |
| --- | --- |
| OpenAPI version | **3.1.0** |
| path 수 | **40** |
| `components.schemas` 수 | **46** |
| `securitySchemes` | `bearerAuth` (http bearer JWT) |
| `nullable` 키 | **0** |
| `type: ["…", "null"]` union | **10** |
| `oneOf` / `anyOf` | **0** |
| `required` 배열 합계(스키마별) | **186** |

### Page response schema (구조 유지)

`PostPageResponse`, `CampaignPageResponse`, `ReportsPageResponse`, `PostCommentsPageResponse`,
`CampaignCommentsResponse`, `PostSearchResponse`, `CampaignSearchResponse`, `NotificationsResponse` —
공통 필드 `content`, `page`, `size`, `totalElements`, `totalPages` 및 `required` 배열 **Boot 3.5 와 동일**.

### 주요 DTO required/optional (Boot 4.1)

| DTO | required (요약) | optional/nullable 필드 표현 |
| --- | --- | --- |
| `SignupRequest` / `LoginRequest` | email, password, name / email, password | 변경 없음 |
| `AuthResponse` | token, name, verified | 변경 없음 |
| `ChangePasswordResponse` | changed | `token`: `type: ["string","null"]` |
| `CreatePostRequest` / `UpdatePostRequest` | text, images, tags | `campaignId`: union nullable |
| `PostResponse` | id, author, text, … (campaignId **미포함**) | `campaignId`: union nullable |
| `PostCommentResponse` | id, text, author, … (updatedAt **미포함**) | `updatedAt`: union nullable |
| `CreateReportRequest` | targetType, targetId, reason | `detail`: union nullable |
| `ReportResponse` | id, targetType, … (detail **미포함**) | `detail`: union nullable |
| `NotificationResponse` | id, type, title, … (readAt/createdAt **미포함**) | `readAt`, `createdAt`: union nullable |
| `CampaignCommentResponse` | id, text, … (updatedAt **미포함**) | `updatedAt`: union nullable |

Error response 전용 schema 는 OpenAPI components 에 **없음** (기존과 동일, 전역 ProblemDetail 미노출).

---

## Boot 3.5 비교 (`ead3ecd` vs `f1874e6`)

**비교 수행: 완료** (worktree `Dasida-boot35` @ `ead3ecd`, springdoc 2.8.14 / Boot 3.5.0)

| 비교 항목 | Boot 3.5 (`ead3ecd`) | Boot 4.1 (`f1874e6`) | 영향도 |
| --- | --- | --- | --- |
| OpenAPI version | 3.1.0 | 3.1.0 | **낮음** (동일) |
| path 수 | 40 | 40 | **낮음** |
| schema 수 | 46 | 46 | **낮음** |
| path 추가/삭제 | 없음 | 없음 | **낮음** |
| schema 이름 추가/삭제 | 없음 | 없음 | **낮음** |
| `operationId` 변경 | — | 0건 | **낮음** |
| schema `required` 배열 변경 | — | 0건 | **낮음** |
| `securitySchemes` | bearerAuth | bearerAuth (동일) | **낮음** |
| `nullable: true` 키 | 0 | 0 | **낮음** (표현 방식 차이) |
| nullable 표현 | optional 필드: `type: T` only | optional 필드: `type: [T, null]` | **중간** (codegen 타입만) |

### Boot 4.1 에서만 `type: ["…", "null"]` 로 바뀐 10개 필드

| schema.field | Boot 3.5 | Boot 4.1 | Kotlin 원인 |
| --- | --- | --- | --- |
| `CreatePostRequest.campaignId` | `type: string` | `type: [string, null]` | `String?` |
| `UpdatePostRequest.campaignId` | 동일 | union | `String?` |
| `PostResponse.campaignId` | 동일 | union | `String?` |
| `PostCommentResponse.updatedAt` | 동일 | union | `Instant?` |
| `CampaignCommentResponse.updatedAt` | 동일 | union | `Instant?` |
| `ChangePasswordResponse.token` | 동일 | union | `String?` |
| `NotificationResponse.readAt` | 동일 | union | `Instant?` |
| `NotificationResponse.createdAt` | 동일 | union | `Instant?` |
| `CreateReportRequest.detail` | 동일 | union | `String?` |
| `ReportResponse.detail` | 동일 | union | `String?` |

**해석:** Boot 3.5 springdoc 도 이미 OpenAPI **3.1.0** 을 출력하지만, Jackson 2 기반 스키마 생성은 nullable 을 `nullable: true` 가 아닌 **non-required + 단일 type** 으로 완화 표현했다.
Boot 4.1 + Jackson 3 + springdoc 3.0.3 은 OpenAPI 3.1 권장 방식인 **type union** 으로 nullable 을 명시한다.
`required` 배열은 양쪽 모두 동일하므로 **HTTP validation / JSON 직렬화 계약은 변하지 않았다.**

---

## codegen 영향 가능성

### 현재 프론트 (`apps/web`)
- OpenAPI / swagger / codegen 관련 설정·스크립트 **없음** (수동 `fetch` + TypeScript 타입).
- **즉시 깨지는 codegen 산출물 없음.**

### 향후 codegen 도입 시
| 시나리오 | 영향 |
| --- | --- |
| `required` 기반 optional (`field?`) | **영향 없음** — required 배열 동일 |
| `nullable: true` 키 의존 | **양쪽 모두 0건** — 이 키에 의존하는 도구는 원래 동작 안 함 |
| `type: ["string","null"]` → `string \| null` | **중간** — Boot 4.1 에서 10개 필드만 union 타입 생성 가능 |
| Page wrapper (`content`, `page`, …) | **영향 없음** |

### 계약 변경으로 봐야 하는 항목
- **없음** (path·required·security·Page 구조·enum·operationId 동일).

### 후속 조치
- **필수:** 없음 (API/DTO 변경 불필요).
- **권장:** OpenAPI codegen 도입 시 Boot 4.1 기준 snapshot 으로 `String?` / `Instant?` 필드 매핑 정책을 팀 문서에 명시.
- **관찰:** Hibernate JSON 경로 Jackson 2 병행, PR #113 보류 등은 `spring-boot-4-1-migration-check.md` 후속 항목 참조.

---

## 검증 명령 (이번 작업)

| 명령 | 결과 |
| --- | --- |
| `cd apps/api && ./gradlew clean test build --no-daemon` | **542/542 성공** |
| `git diff --check` | **통과** |
| OpenAPI JSON parse (`python -m json.tool`) | Boot 3.5·4.1 snapshot **유효** |
| web tsc/lint/build | **생략** (프론트 미변경) |

## 변경 범위 (이번 PR)

- **추가:** `docs/backend/openapi-nullability-contract-check.md`
- **추가:** `docs/backend/openapi-snapshots/.gitignore` (snapshot JSON 로컬 전용)
- **production code / dependency / API·DTO·JWT·DB / frontend:** 변경 없음
- **SecurityConfig / CORS / OpenAPI / Actuator 정책:** 변경 없음

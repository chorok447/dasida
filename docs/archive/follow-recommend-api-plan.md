# Follow · Recommend API 기획

> 기준: `origin/develop` (`8d06323`)  
> 대상: **크리에이터 팔로우** + **크리에이터 추천**  
> 참고: 캠페인 추천은 이미 `GET /api/campaigns/search`로 구현됨 (`RecommendedCampaigns`)

---

## 1. 배경

| 현상 | 원인 |
|------|------|
| 피드 사이드바 "크리에이터 추천" 제거됨 | follow/recommend API 없이 placeholder만 있었음 |
| `/users/[id]` 프로필에 팔로우 버튼 없음 | follow 상태·카운트 API 없음 |
| design-reference `SideRecommend` | "이런 분 어때요" + 팔로우 버튼 UI만 존재 |

**목표:** 최소 API로 팔로우 관계를 저장하고, 피드 사이드바·공개 프로필에서 쓸 수 있게 한다. 추천은 v1에서 단순 랭킹으로 시작한다.

---

## 2. 용어

| 용어 | 의미 |
|------|------|
| **Follow** | A가 B를 팔로우 — 단방향, 승인 불필요 |
| **Recommend (creator)** | 로그인 사용자에게 보여줄 팔로우 후보 크리에이터 목록 |
| **Recommend (campaign)** | 기존 구현 유지. 본 문서 범위 밖 |

---

## 3. 범위

### 3.1 MVP (1차 PR)

- [ ] `user_follows` 테이블 + JPA 엔티티
- [ ] 팔로우 / 언팔로우 / 팔로우 여부 조회
- [ ] 공개 프로필에 `followerCount`, `followingCount`, (로그인 시) `followedByMe`
- [ ] `GET /api/users/recommended` — 크리에이터 추천 4~5명
- [ ] 피드 사이드바 `FeedSideRecommend` 복원
- [ ] `/users/[id]` 팔로우 버튼

### 3.2 2차 (별도 PR)

- [ ] 팔로잉 목록 / 팔로워 목록 페이지 API (`page`+`size`)
- [ ] 피드 필터 `followingOnly` — 팔로우한 작성자 글만
- [ ] 알림 `USER_FOLLOWED` (선택)

### 3.3 하지 않을 것 (v1)

- 맞팔로우·승인형 팔로우
- DM, 뮤트, 차단
- ML/그래프 기반 추천
- 팔로우 상한 (트래픽 보이면 추가)

---

## 4. 데이터 모델

`CampaignParticipant` 패턴을 그대로 따른다.

```sql
CREATE TABLE user_follows (
  id            VARCHAR(64)  PRIMARY KEY,
  follower_id   BIGINT       NOT NULL,
  followee_id   BIGINT       NOT NULL,
  created_at    TIMESTAMP(6) NOT NULL,
  UNIQUE KEY uk_user_follows_pair (follower_id, followee_id),
  INDEX idx_user_follows_followee (followee_id),
  INDEX idx_user_follows_follower (follower_id)
);
```

| 필드 | 설명 |
|------|------|
| `follower_id` | 팔로우하는 사용자 (`users.id`) |
| `followee_id` | 팔로우 대상 |
| `created_at` | 정렬·감사용 |

**제약 (앱 레벨):**

- `follower_id != followee_id`
- 삭제된 사용자(`deleted_at IS NOT NULL`)는 followee 불가
- 중복 팔로우 → idempotent (이미 있으면 200/204)

---

## 5. Follow API

Base path: `/api/users` (`UserController` 확장 또는 `FollowController` 분리 — 팀 취향, 단일 컨트롤러면 충분)

### 5.1 엔드포인트

| Method | Path | Auth | 설명 |
|--------|------|------|------|
| `POST` | `/api/users/{id}/follow` | 필수 | 팔로우 |
| `DELETE` | `/api/users/{id}/follow` | 필수 | 언팔로우 |
| `GET` | `/api/users/{id}/follow` | 필수 | 내가 이 사용자를 팔로우 중인지 `{ followed: boolean }` |
| `GET` | `/api/users/me/following` | 필수 | 내 팔로잉 목록 (2차) |
| `GET` | `/api/users/me/followers` | 필수 | 내 팔로워 목록 (2차) |

### 5.2 공개 프로필 확장

기존 `GET /api/users/{id}` (`PublicUserResponse`) 필드 추가:

```kotlin
data class PublicUserResponse(
    // 기존: id, name, verified, profileImageUrl, postCount
    val followerCount: Int,
    val followingCount: Int,
    val followedByMe: Boolean? = null, // JWT 있을 때만 true/false, 없으면 null
)
```

### 5.3 응답·에러

| 상황 | HTTP |
|------|------|
| 자기 자신 팔로우 | `400` |
| 없는/삭제된 사용자 | `404` |
| 비로그인 POST/DELETE | `401` |
| 언팔로우 — 관계 없음 | `204` (idempotent) |

### 5.4 SecurityConfig

```kotlin
it.requestMatchers(HttpMethod.POST, "/api/users/*/follow").authenticated()
it.requestMatchers(HttpMethod.DELETE, "/api/users/*/follow").authenticated()
it.requestMatchers(HttpMethod.GET, "/api/users/*/follow").authenticated()
it.requestMatchers(HttpMethod.GET, "/api/users/me/following", "/api/users/me/followers").authenticated()
// GET /api/users/recommended → authenticated
// GET /api/users/{id} → 기존처럼 permitAll (followedByMe는 principal null이면 null)
```

---

## 6. Recommend API (크리에이터)

### 6.1 엔드포인트

| Method | Path | Auth | 설명 |
|--------|------|------|------|
| `GET` | `/api/users/recommended` | 필수 | 추천 크리에이터 목록 |

Query: `size` (default `4`, max `10`)

### 6.2 응답

```json
{
  "items": [
    {
      "id": 12,
      "name": "초록도시",
      "verified": false,
      "profileImageUrl": null,
      "postCount": 8,
      "followedByMe": false
    }
  ]
}
```

`PublicUserResponse` + `followedByMe` 재사용. 별도 DTO 불필요.

### 6.3 v1 추천 알고리즘 (ponytail)

복잡한 추천 엔진 없이 SQL 한 방:

1. `posts.author_user_id IS NOT NULL` 인 작성자만 후보
2. `postCount >= 1`
3. 정렬: `SUM(post.likes) DESC`, 동점이면 `COUNT(post.id) DESC`
4. 제외: 본인, 이미 팔로우 중, `deleted_at` 있는 사용자
5. `LIMIT size`

구현 위치: `UserFollowRepository` + `PostRepository` 집계 쿼리 또는 QueryDSL.  
시드 데이터가 적어도 동작해야 하므로 후보 0명이면 **빈 배열** 반환 (placeholder 문구 없음).

### 6.4 이후 개선 (측정 후)

- 최근 30일 활동 가중치
- 캠페인 참여·인증 사용자 부스트
- "비슷한 태그" — 태그 JSON 스캔은 v2 이후

---

## 7. 프론트 연동

| 화면 | 변경 |
|------|------|
| `feed-sidebar.tsx` | `FeedSideRecommend` 복원 — `GET /api/users/recommended` |
| `users/[id]/user-profile-client.tsx` | 팔로우/언팔로우 버튼, 팔로워·팔로잉 수 |
| `data/users.ts` | `followUser`, `unfollowUser`, `fetchRecommendedUsers`, 타입 확장 |
| design-reference `SideRecommend` | 프로덕션과 동일 API 연동 시 참고용 |

**사이드바 UX (design-reference 기준):**

- 제목: "이런 분 어때요"
- 행: 아바타 + 이름(→ `/users/{id}`) + 팔로우 버튼
- 팔로우 후 버튼 → "팔로잉" / 언팔로우 (2차에서 토글 UX 정리 가능)

**비로그인:** 사이드바 추천 섹션 숨김 또는 "로그인 후 추천" — v1은 **숨김**이 단순.

---

## 8. 구현 티켓 (권장 순서)

### Ticket 1 — Follow 백엔드

- Entity `UserFollow`, Repository, Service
- `POST/DELETE/GET .../follow`
- `PublicUserResponse` 카운트·`followedByMe`
- `UserControllerTest` + follow 시나리오

### Ticket 2 — Recommend 백엔드

- `GET /api/users/recommended`
- 집계 쿼리 + 제외 로직
- 시드/빈 DB에서 빈 목록 테스트

### Ticket 3 — 프론트

- `users.ts` API 클라이언트
- 프로필 팔로우 버튼
- `FeedSideRecommend` 복원
- component test 1~2개 (링크·팔로우 상태)

### Ticket 4 (2차) — 팔로잉 피드

- `PostSearchCondition`에 `authorUserIds` 또는 `followingOnly`
- 피드 `FeedControls` 필터 칩
- e2e: 팔로우 → 피드에 해당 작성자 글 노출

---

## 9. 완료 조건 (MVP)

```bash
# API
cd apps/api && ./gradlew test

# Web
pnpm --filter web test
pnpm --filter web build

# 수동
# - 로그인 → 피드 사이드바 추천 4명 노출
# - 추천에서 팔로우 → 프로필에서 followedByMe=true, 카운트 반영
# - 본인 프로필에는 팔로우 버튼 없음
# - 비로그인 → 추천 섹션 미노출
```

---

## 10. 의존성·리스크

| 항목 | 대응 |
|------|------|
| 시드 작성자 `author_user_id` null | 추천 후보에서 자동 제외; 시드 정비는 별도 |
| 팔로워 수 스팸 | v1 무시; 상한·rate limit은 트래픽 후 |
| `GET /api/users/recommended` vs `GET /api/users/{id}` 라우팅 | Spring은 `recommended`를 `{id}`보다 **먼저** 매핑 |

---

## 11. 한 줄 요약

**Follow는 `user_follows` 한 테이블 + 프로필 카운트, Recommend는 게시글 인기 작성자 Top-N — 이 두 개면 제거했던 사이드바와 프로필 팔로우를 되살릴 수 있다.**

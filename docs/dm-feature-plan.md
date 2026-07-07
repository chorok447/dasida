# DM(Direct Message) 기능 기획

> 기준: `origin/develop` (팔로우·추천 PR #245 머지 후)  
> 목표: **1:1 텍스트 DM MVP** — 외부 메신저 없이 게시글·캠페인·팔로우 관계를 이어주는 가벼운 대화  
> 참고: 알림은 기존 `NotificationService` + `MESSAGE_RECEIVED` 타입 재사용

---

## 1. 배경

| 현상 | 기회 |
|------|------|
| `/users/[id]`에 팔로우는 있으나 **연락 수단 없음** | 프로필·게시글·캠페인에서 형성된 관계를 DM으로 연결 |
| 알림(`/notifications`)은 헤더 벨 아이콘으로만 진입 | DM 전용 목록 + 읽지 않음 배지 필요 |
| **사용자 차단 API 없음** | DM 정책(§8)을 쓰려면 `user_blocks` 최소 구현 동반 |

**원칙 (ponytail):** Phase 1은 REST 폴링만. WebSocket·이미지·그룹은 Phase 2 이후.

---

## 2. MVP 범위

### 2.1 포함

- [x] 1:1 대화 (동일 상대당 Conversation 1개)
- [x] 텍스트 메시지 전송·조회 (페이지네이션)
- [x] 대화 목록 (마지막 메시지·시간·읽지 않음 수)
- [x] 채팅방 진입 시 읽음 처리
- [x] `MESSAGE_RECEIVED` 알림 → 채팅방 `href` 이동
- [x] 프로필 **메시지 보내기** 버튼
- [x] 네비게이션 **DM** 메뉴 (헤더 + 모바일 하단)
- [x] `user_blocks` + 차단 시 신규 대화·전송 거부

> **차단 UI**: MVP는 API만 (`POST/DELETE /api/users/{id}/block`). 마이페이지·프로필 메뉴 UI는 2차.

### 2.2 제외 (명시)

| 항목 | 시기 |
|------|------|
| 그룹 채팅, 이미지/파일, 음성, 이모지 | Phase 3 |
| 메시지 수정·삭제 | Phase 3 |
| Typing·온라인 상태·실시간 읽음 | Phase 2 (WebSocket) |
| 메시지 검색·Reply·반응 | Phase 3 |

---

## 3. 사용자 플로우

### 3.1 새 대화

```
/users/{id} → [메시지 보내기] (본인·탈퇴·차단 시 숨김/비활성)
  → POST /api/messages/conversations { peerUserId }
  → 기존 1:1 있으면 그 id, 없으면 생성
  → /messages/{conversationId}
```

진입점 (MVP):

- 공개 프로필 `/users/[id]`
- 게시글 상세 작성자 영역 **메시지** 버튼

### 3.2 기존 대화

```
/messages → 목록 → /messages/{id} → 전송 → 상대 알림
```

### 3.3 알림

```
MESSAGE_RECEIVED → href: /messages/{conversationId}
```

기존 `notification-row.tsx`에 아이콘·라벨 추가 (`MessageCircle` 등).

---

## 4. 네비게이션

현재:

- `MAIN_NAV_ITEMS`: 홈·피드·캠페인·마이페이지·로고
- `MobileBottomNav`: 홈·피드·캠페인·마이 (알림 없음)
- 알림: `SiteHeader` 벨 아이콘

변경 (MVP):

| 위치 | 추가 |
|------|------|
| `nav-items.ts` | `{ label: "DM", href: "/messages" }` — 로고 앞 |
| `mobile-bottom-nav.tsx` | DM 탭 (`MessageCircle`), 5탭 — 알림은 계속 헤더 |
| `site-header.tsx` | DM 링크 또는 unread 배지 (대화 미읽음 합계) |

`PROTECTED_PREFIXES`에 `/messages` 추가.

---

## 5. 화면

### 5.1 `/messages` — 대화 목록

- `PaginatedSection` 패턴 재사용 (`mypage/paginated-section.tsx`)
- 행: 아바타, 이름, 마지막 메시지 미리보기(1줄), 상대시간, unread 배지
- 빈 상태: "아직 대화가 없어요" + 팔로우/피드 안내

### 5.2 `/messages/[id]` — 채팅방

- 상단: 상대 프로필 링크 (`AuthorHeader` 축약)
- 본문: 날짜 구분선 + 말풍선 (내/상대 CSS만 분기)
- 하단: `<textarea>` + 전송 — **Enter 전송, Shift+Enter 줄바꿈**
- 진입 시 `POST .../read` → 목록 unread 갱신
- 메시지 목록: `GET .../messages?page&size` — **오래된 순 표시, 스크롤 하단 고정**
- ponytail: Phase 1은 **전송 후 refetch** 또는 낙관적 append. WebSocket 없음.

### 5.3 프로필

`/users/[id]/user-profile-client.tsx`:

- 팔로우 버튼 옆 **메시지 보내기** (로그인·타인·비차단일 때만)

---

## 6. 권한·차단

| 조건 | 동작 |
|------|------|
| 비로그인 | `/messages` → 로그인 유도 |
| 자기 자신 | 메시지 보내기 숨김, API `400` |
| `deleted_at` 있는 사용자 | `404`, 버튼 숨김 |
| A가 B 차단 (또는 B가 A 차단) | 신규 Conversation `403`, 전송 `403` |
| 기존 대화 + 차단 후 | 목록·이력 **조회 가능**(읽기 전용), **신규 전송만 차단** |

### `user_blocks` (MVP 동반)

```sql
CREATE TABLE user_blocks (
  id            VARCHAR(64)  PRIMARY KEY,
  blocker_id    BIGINT       NOT NULL,
  blocked_id    BIGINT       NOT NULL,
  created_at    TIMESTAMP(6) NOT NULL,
  UNIQUE KEY uk_user_blocks_pair (blocker_id, blocked_id)
);
```

API (최소):

- `POST /api/users/{id}/block`
- `DELETE /api/users/{id}/block`

UI는 마이페이지·프로필 메뉴 2차 — **API만 먼저** DM과 같이 배포.

---

## 7. 데이터 모델

`CampaignParticipant` / `user_follows` 패턴. Flyway `V4__dm.sql` (V3=user_follows 이후).

### 7.1 `conversations`

| 컬럼 | 설명 |
|------|------|
| `id` | `conv-{uuid}` |
| `user_low_id` / `user_high_id` | 1:1 유일성 (`UNIQUE(user_low_id, user_high_id)`) |
| `last_message_id` | 목록 정렬·미리보기용 (nullable) |
| `updated_at` | 목록 정렬 |

ponytail: participant 2행 테이블 대신 **정렬된 user pair**로 1:1 강제. 조회는 `conversation_participants` 없이 pair로 충분.

### 7.2 `conversation_members` (읽음·목록용)

| 컬럼 | 설명 |
|------|------|
| `conversation_id` | FK |
| `user_id` | FK |
| `last_read_message_id` | nullable — 이 id 이하 읽음 |
| `joined_at` | |

`UNIQUE(conversation_id, user_id)`

unread = `messages` where `id > last_read_message_id` and `sender_id != me`

### 7.3 `messages`

| 컬럼 | 설명 |
|------|------|
| `id` | `msg-{uuid}` |
| `conversation_id` | |
| `sender_id` | |
| `content` | TEXT, max 2000자 (앱 검증) |
| `type` | `TEXT` only (MVP) |
| `created_at` | |
| `seq` | BIGINT — 정렬용 (`System.nanoTime()` 패턴, notifications와 동일) |

인덱스: `(conversation_id, seq DESC)`

---

## 8. API

Base: `/api/messages` — 전부 **authenticated**.

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/conversations` | body `{ peerUserId }` → find-or-create, `{ id, peer, ... }` |
| `GET` | `/conversations` | 내 대화 목록 `page`, `size` |
| `GET` | `/conversations/unread-count` | 헤더 DM 배지용 합계 |
| `GET` | `/conversations/{id}` | 단일 대화 요약 (채팅방 헤더용) |
| `GET` | `/conversations/{id}/messages` | 메시지 페이지 (`page`, `size`, 최신순 API → UI에서 reverse) |
| `POST` | `/conversations/{id}/messages` | body `{ content }` → MessageResponse |
| `POST` | `/conversations/{id}/read` | 진입 시 읽음 (최신까지) |

### 응답 DTO (요약)

```kotlin
data class ConversationSummaryResponse(
    val id: String,
    val peer: PublicUserResponse,  // 기존 DTO 재사용
    val lastMessage: MessagePreview?,
    val unreadCount: Int,
    val updatedAt: String,
)

data class MessageResponse(
    val id: String,
    val senderId: Long,
    val content: String,
    val createdAt: String,
    val mine: Boolean,
)
```

### SecurityConfig

```kotlin
it.requestMatchers("/api/messages/**").authenticated()
```

### 알림

```kotlin
NotificationType.MESSAGE_RECEIVED = "MESSAGE_RECEIVED"
// notify(recipient, sender, type, title, body, href = "/messages/$conversationId")
```

`content` 미리보기 50자 truncate. actor==recipient 방지.

---

## 9. 프론트 파일 (예상)

| 파일 | 역할 |
|------|------|
| `apps/web/src/data/messages.ts` | API 클라이언트 |
| `apps/web/src/app/messages/page.tsx` | 목록 |
| `apps/web/src/app/messages/[id]/page.tsx` | 채팅방 |
| `apps/web/src/app/messages/conversation-list.tsx` | 목록 UI |
| `apps/web/src/app/messages/conversation-room.tsx` | 채팅 UI |
| `nav-items.ts`, `mobile-bottom-nav.tsx` | 메뉴 |
| `user-profile-client.tsx` | 메시지 보내기 |
| `notifications.ts`, `notification-row.tsx` | MESSAGE_RECEIVED |

---

## 10. 개발 티켓 (권장 순서)

### Ticket 1 — DB + 차단

- Flyway `V4__dm.sql` + `user_blocks`
- `UserBlock` entity/repository/service
- block API + DM 전송/생성 시 검사

### Ticket 2 — DM 백엔드

- `Conversation`, `ConversationMember`, `Message`
- `MessageService` — find-or-create, send, list, read
- `MessageController` + tests

### Ticket 3 — 알림

- `MESSAGE_RECEIVED` + `UserControllerTest`/`MessageServiceTest` 수준 검증

### Ticket 4 — 프론트 DM

- `/messages`, `/messages/[id]`
- 프로필 메시지 보내기
- nav + unread 배지

### Ticket 5 — e2e

- A 가입 → B 프로필에서 메시지 → B 알림 → B 답장 → 읽음/목록 확인

---

## 11. Phase 2 — WebSocket (진행 중)

| 항목 | 상태 |
|------|------|
| `GET /ws/messages` WebSocket (쿠키 JWT) | ✅ |
| 실시간 메시지 push | ✅ |
| typing 이벤트 | ✅ |
| 읽음 실시간 반영 | ✅ |
| 온라인(대화방 구독 중) | ✅ |
| Redis pub/sub (다중 인스턴스) | ✅ |
| 헤더 배지 로컬 갱신 (inbox `totalUnread`) | ✅ |
| 전역 단일 DM WebSocket | ✅ |

## 12. Phase 3 (문서만)

```bash
./gradlew test
pnpm --filter web test
pnpm --filter web lint
pnpm build:web
# e2e: messages.spec.ts
```

수동 (로컬 확인):

- [ ] 프로필 → 메시지 → 기존 대화 재진입 시 새 Conversation 안 생김
- [ ] 차단 후 전송 403
- [ ] 알림 탭 → 채팅방 이동
- [ ] 모바일 하단 DM 탭 동작

> 구현 브랜치: `feat/dm-mvp` (미커밋). API 테스트·lint·build 통과.

---

## 13. 한 줄 요약

**정렬된 user pair 1테이블 + messages + 읽음 포인터 + 기존 Notification — REST만으로 MVP DM은 충분하다. 차단 테이블은 정책상 MVP에 같이 넣는다.**

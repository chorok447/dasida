# 알림 필터(타입 탭) + 안읽음 조합(AND) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 알림 페이지의 타입 필터 탭(전체/좋아요·댓글/캠페인/팔로우/메시지)과 "안읽음만 보기"를 서로 독립적인 두 축으로 분리해 동시에(AND) 적용할 수 있게 한다.

**Architecture:** 백엔드는 `GET /api/notifications`의 `types`/`unreadOnly` 분기를 "types 우선"에서 "둘 다 있으면 AND"로 바꾼다. 프론트는 알림 페이지의 단일 `filter` state에서 "안읽음" 탭을 분리해 `unreadOnly: boolean` 별도 state로 만들고, 두 값을 함께 `fetchNotifications`에 전달한다.

**Tech Stack:** Kotlin/Spring Boot(MockMvc+H2 통합 테스트), Next.js/React(TS), Playwright e2e.

## Global Constraints

- 커밋 메시지는 `type: 설명` 형식(예: `feat: ...`, `test: ...`), 첫 글자 뒤 마침표 없이, 명령문/명사형으로 작성한다. AI 서명/공동작성자 표기 금지.
- `GET /api/notifications`의 기존 파라미터(`page`/`size`/`unreadOnly`/`types`)와 응답 envelope(`NotificationsResponse`)은 그대로 유지한다 — 의미만 "types 우선"에서 "AND 조합"으로 바뀐다.
- 타입 탭은 계속 단일 선택이다(여러 타입 그룹 동시 선택은 범위 밖).
- 그룹별 전용 빈 상태 문구는 만들지 않는다 — 기존 기본 문구를 `unreadOnly` 기준으로 재사용한다.
- 새 의존성을 추가하지 않는다.

---

### Task 1: 백엔드 — types + unreadOnly AND 조합

**Files:**
- Modify: `apps/api/src/main/kotlin/com/dasida/api/notification/NotificationRepository.kt`
- Modify: `apps/api/src/main/kotlin/com/dasida/api/notification/NotificationService.kt:21-44`
- Test: `apps/api/src/test/kotlin/com/dasida/api/notification/NotificationControllerTest.kt`

**Interfaces:**
- Produces: `NotificationService.getNotifications(userId, page, size, unreadOnly, types)` — `types`와 `unreadOnly`가 둘 다 있으면 AND, `types`만 있으면 타입만, `unreadOnly`만 있으면 안읽음만, 둘 다 없으면 전체. `NotificationController`/API 시그니처는 변경 없음(내부 분기만 바뀜).

- [ ] **Step 1: 실패하는 테스트로 교체**

`apps/api/src/test/kotlin/com/dasida/api/notification/NotificationControllerTest.kt`에서 기존 `types 필터는 지정한 타입만 조회하고 unreadOnly보다 우선한다` 테스트(131-148행)를 통째로 아래로 교체:

```kotlin
    @Test
    fun `types 필터와 unreadOnly를 함께 보내면 AND로 좁혀진다`() {
        save(me, id = "noti-like-read", type = NotificationType.POST_LIKED, read = true)
        save(me, id = "noti-like-unread", type = NotificationType.POST_LIKED, read = false)
        save(me, id = "noti-comment-unread", type = NotificationType.POST_COMMENT_CREATED, read = false)
        save(me, id = "noti-follow-unread", type = NotificationType.USER_FOLLOWED, read = false)

        // types만: 읽음 여부와 무관하게 해당 타입 전부.
        list(types = listOf(NotificationType.POST_LIKED, NotificationType.POST_COMMENT_CREATED)).andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(3) }
            jsonPath("$.content[*].id") {
                value(Matchers.containsInAnyOrder("noti-like-read", "noti-like-unread", "noti-comment-unread"))
            }
        }
        // types + unreadOnly: 두 조건을 모두 만족하는 것만(AND) — 읽은 noti-like-read는 제외된다.
        list(types = listOf(NotificationType.POST_LIKED, NotificationType.POST_COMMENT_CREATED), unreadOnly = true).andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(2) }
            jsonPath("$.content[*].id") { value(Matchers.containsInAnyOrder("noti-like-unread", "noti-comment-unread")) }
        }
    }
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd apps/api && ./gradlew test --tests "com.dasida.api.notification.NotificationControllerTest"`
Expected: `types 필터와 unreadOnly를 함께 보내면 AND로 좁혀진다` FAIL — 두 번째 assertion에서 `content.length()`가 3으로 나와 실패(현재 로직은 types가 있으면 unreadOnly를 무시하기 때문).

- [ ] **Step 3: Repository에 AND 조회 메서드 추가**

`NotificationRepository.kt`의 인터페이스 본문(11-16행)에 추가:

```kotlin
interface NotificationRepository : JpaRepository<Notification, String> {
    fun findByUserId(userId: Long, pageable: Pageable): Page<Notification>
    fun findByUserIdAndReadAtIsNull(userId: Long, pageable: Pageable): Page<Notification>
    fun findByUserIdAndTypeIn(userId: Long, types: List<String>, pageable: Pageable): Page<Notification>
    fun findByUserIdAndTypeInAndReadAtIsNull(userId: Long, types: List<String>, pageable: Pageable): Page<Notification>
    fun countByUserIdAndReadAtIsNull(userId: Long): Long
    fun findByIdAndUserId(id: String, userId: Long): Notification?
```

(이하 `markAllRead`/`deleteReadByUserId`는 그대로 둔다.)

- [ ] **Step 4: Service 분기를 AND로 변경**

`NotificationService.kt`의 `getNotifications` 안의 `when` 블록(31-35행)을 교체:

```kotlin
        val result = when {
            types.isNotEmpty() && unreadOnly -> repo.findByUserIdAndTypeInAndReadAtIsNull(userId, types, pageable)
            types.isNotEmpty() -> repo.findByUserIdAndTypeIn(userId, types, pageable)
            unreadOnly -> repo.findByUserIdAndReadAtIsNull(userId, pageable)
            else -> repo.findByUserId(userId, pageable)
        }
```

- [ ] **Step 5: 테스트 실행해서 통과 확인**

Run: `cd apps/api && ./gradlew test --tests "com.dasida.api.notification.NotificationControllerTest"`
Expected: PASS (전체 그린)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/main/kotlin/com/dasida/api/notification/NotificationRepository.kt apps/api/src/main/kotlin/com/dasida/api/notification/NotificationService.kt apps/api/src/test/kotlin/com/dasida/api/notification/NotificationControllerTest.kt
git commit -m "feat: 알림 목록 조회에서 types와 unreadOnly를 AND로 조합"
```

---

### Task 2: 프론트 — 필터 탭에서 안읽음 분리 + 독립 토글

**Files:**
- Modify: `apps/web/src/app/notifications/notifications-client.tsx`

**Interfaces:**
- Consumes: `fetchNotifications(page, size, unreadOnly, types?)` (기존 시그니처, 변경 없음 — `apps/web/src/data/notifications.ts`)
- Produces: 없음 (leaf UI). `NotificationFilterId`는 이 파일 내부 전용.

- [ ] **Step 1: 필터 타입에서 "안읽음" 제거**

`notifications-client.tsx`의 33-49행을 교체:

```tsx
type NotificationFilterId = "all" | "social" | "campaign" | "follow" | "message";

const FILTER_GROUP_TYPES: Partial<Record<NotificationFilterId, string[]>> = {
  social: ["POST_LIKED", "POST_COMMENT_CREATED", "CAMPAIGN_COMMENT_CREATED"],
  campaign: ["CAMPAIGN_JOINED", "CAMPAIGN_PARTICIPATION_REMOVED", "CAMPAIGN_STATUS_CHANGED"],
  follow: ["USER_FOLLOWED"],
  message: ["MESSAGE_RECEIVED"],
};

const filters: { id: NotificationFilterId; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "social", label: "좋아요·댓글" },
  { id: "campaign", label: "캠페인" },
  { id: "follow", label: "팔로우" },
  { id: "message", label: "메시지" },
];
```

- [ ] **Step 2: unreadOnly state 추가, requestIdentity에 반영**

기존:

```tsx
  const [filter, setFilter] = useState<NotificationFilterId>("all");
  const [page, setPage] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const [result, setResult] = useState<Result>({ identity: "", status: "success", data: null });
  const [busy, setBusy] = useState(false); // 모두 읽음 in-flight (중복 클릭 방지)
  const [cleaningRead, setCleaningRead] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set()); // 개별 읽음 in-flight
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState("");

  const generationRef = useRef(0);

  // 요청 identity(토큰·페이지·필터·retry). 저장된 결과가 이 값과 다르면 아직 로딩 중으로 간주(동기 setState 회피).
  const requestIdentity = JSON.stringify([token, page, filter, retryTick]);
```

교체:

```tsx
  const [filter, setFilter] = useState<NotificationFilterId>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const [result, setResult] = useState<Result>({ identity: "", status: "success", data: null });
  const [busy, setBusy] = useState(false); // 모두 읽음 in-flight (중복 클릭 방지)
  const [cleaningRead, setCleaningRead] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set()); // 개별 읽음 in-flight
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState("");

  const generationRef = useRef(0);

  // 요청 identity(토큰·페이지·필터·안읽음·retry). 저장된 결과가 이 값과 다르면 아직 로딩 중으로 간주(동기 setState 회피).
  const requestIdentity = JSON.stringify([token, page, filter, unreadOnly, retryTick]);
```

- [ ] **Step 3: fetch 호출과 effect 의존성에 unreadOnly 반영**

기존:

```tsx
    fetchNotifications(page, PAGE_SIZE, filter === "unread", FILTER_GROUP_TYPES[filter])
```

교체:

```tsx
    fetchNotifications(page, PAGE_SIZE, unreadOnly, FILTER_GROUP_TYPES[filter])
```

기존:

```tsx
  }, [requestIdentity, token, page, filter, router]);
```

교체:

```tsx
  }, [requestIdentity, token, page, filter, unreadOnly, router]);
```

- [ ] **Step 4: hasReadNotifications을 unreadOnly까지 반영하도록 수정**

기존:

```tsx
  const hasReadNotifications = filter === "all" && (data?.totalElements ?? 0) > unreadCount;
```

교체:

```tsx
  const hasReadNotifications = filter === "all" && !unreadOnly && (data?.totalElements ?? 0) > unreadCount;
```

(이유: `totalElements`는 현재 조회 결과의 총 개수이므로, 필터링된 뷰에서는 전체 read 개수를 대표하지 못한다. `filter === "all" && !unreadOnly`일 때만 진짜 전체 목록이므로 이 조건에서만 "읽은 알림 정리" 버튼을 활성화한다.)

- [ ] **Step 5: 안읽음 토글 핸들러 추가**

기존:

```tsx
  const changeFilter = (next: NotificationFilterId) => {
    if (next === filter) return;
    setActionError("");
    setPage(0);
    setFilter(next);
  };
```

교체:

```tsx
  const changeFilter = (next: NotificationFilterId) => {
    if (next === filter) return;
    setActionError("");
    setPage(0);
    setFilter(next);
  };

  const toggleUnreadOnly = () => {
    setActionError("");
    setPage(0);
    setUnreadOnly((prev) => !prev);
  };
```

- [ ] **Step 6: JSX — 필터 탭 옆에 안읽음 토글 버튼 추가**

기존:

```tsx
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div
            className="flex gap-1 p-1 rounded-full"
            style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}
          >
            {filters.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => changeFilter(f.id)}
                  aria-pressed={active}
                  className="relative px-4 py-2 text-[13px] rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3a3]"
                  style={{ color: active ? "var(--surface-dark)" : "var(--foreground-muted)" }}
                >
                  {active && (
                    <motion.div layoutId="notif-filter-pill" className="absolute inset-0 rounded-full" style={{ background: "var(--accent)" }} />
                  )}
                  <span className="relative">{f.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
```

교체:

```tsx
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="flex gap-1 p-1 rounded-full"
              style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}
            >
              {filters.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => changeFilter(f.id)}
                    aria-pressed={active}
                    className="relative px-4 py-2 text-[13px] rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3a3]"
                    style={{ color: active ? "var(--surface-dark)" : "var(--foreground-muted)" }}
                  >
                    {active && (
                      <motion.div layoutId="notif-filter-pill" className="absolute inset-0 rounded-full" style={{ background: "var(--accent)" }} />
                    )}
                    <span className="relative">{f.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={toggleUnreadOnly}
              aria-pressed={unreadOnly}
              className="px-3.5 py-2 text-[13px] rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3a3]"
              style={{
                background: unreadOnly ? "var(--accent)" : dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)",
                color: unreadOnly ? "var(--surface-dark)" : "var(--foreground-muted)",
              }}
            >
              안읽음만
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
```

- [ ] **Step 7: 빈 상태 문구를 unreadOnly 기준으로 교체**

기존:

```tsx
        ) : list.length === 0 ? (
          <div className="space-y-4">
            <StatePanel compact>
              <Bell size={32} className="opacity-35" aria-hidden />
              <p className="font-medium">
                {filter === "unread" ? "안 읽은 알림이 없습니다." : "알림이 없습니다."}
              </p>
              <p className="text-[12px] opacity-60">
                {filter === "unread"
                  ? "새 알림이 오면 이 목록에 표시됩니다."
                  : "관심 있는 캠페인에 참여하면 소식을 알림으로 받을 수 있어요."}
              </p>
            </StatePanel>
            {filter === "all" ? <RecommendedCampaigns heading="참여해볼 만한 캠페인" /> : null}
          </div>
        ) : (
```

교체:

```tsx
        ) : list.length === 0 ? (
          <div className="space-y-4">
            <StatePanel compact>
              <Bell size={32} className="opacity-35" aria-hidden />
              <p className="font-medium">
                {unreadOnly ? "안 읽은 알림이 없습니다." : "알림이 없습니다."}
              </p>
              <p className="text-[12px] opacity-60">
                {unreadOnly
                  ? "새 알림이 오면 이 목록에 표시됩니다."
                  : "관심 있는 캠페인에 참여하면 소식을 알림으로 받을 수 있어요."}
              </p>
            </StatePanel>
            {filter === "all" && !unreadOnly ? <RecommendedCampaigns heading="참여해볼 만한 캠페인" /> : null}
          </div>
        ) : (
```

- [ ] **Step 8: 타입 체크로 검증**

Run: `CI=true pnpm --filter web exec tsc --noEmit`
Expected: 에러 없음 (단, `src/lib/authed-request.test.ts`에 이 브랜치와 무관한 pre-existing 에러 1개가 보일 수 있음 — 무시)

- [ ] **Step 9: lint로 검증**

Run: `CI=true pnpm --filter web lint -- src/app/notifications/notifications-client.tsx`
Expected: 에러 없음

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/notifications/notifications-client.tsx
git commit -m "feat: 알림 페이지에서 안읽음 필터를 타입 탭과 독립적으로 적용"
```

---

### Task 3: E2E — types + 안읽음 AND 조합 시나리오

**Files:**
- Modify: `apps/web/e2e/notifications.spec.ts`

**Interfaces:**
- Consumes: Task 2의 필터 탭 라벨("캠페인", "전체")과 새 "안읽음만" 토글 버튼(`role="button"`, 접근 가능한 이름 "안읽음만").

- [ ] **Step 1: 기존 캠페인 참여 알림 e2e에 AND 조합 시나리오 삽입**

`apps/web/e2e/notifications.spec.ts`에서 아래 블록:

```ts
  await ownerPage.getByRole("button", { name: "읽음으로 표시" }).click();
  await expect(ownerPage.getByRole("heading", { name: "알림", exact: true })).toBeVisible();
  await expect(ownerPage.getByRole("heading", { name: /알림 \(1\)/ })).not.toBeVisible();

  await ownerPage.getByRole("button", { name: "알림 삭제" }).click();
```

를 아래로 교체(AND 조합 검증 6줄 삽입):

```ts
  await ownerPage.getByRole("button", { name: "읽음으로 표시" }).click();
  await expect(ownerPage.getByRole("heading", { name: "알림", exact: true })).toBeVisible();
  await expect(ownerPage.getByRole("heading", { name: /알림 \(1\)/ })).not.toBeVisible();

  // types + 안읽음만 조합(AND): 읽음 처리된 알림은 타입이 맞아도 안읽음만 볼 때는 안 보인다.
  await ownerPage.getByRole("button", { name: "캠페인", exact: true }).click();
  await ownerPage.getByRole("button", { name: "안읽음만", exact: true }).click();
  await expect(ownerPage.getByText("알림이 없습니다.")).toBeVisible();
  await ownerPage.getByRole("button", { name: "안읽음만", exact: true }).click();
  await expect(ownerPage.getByRole("link", { name: /캠페인에 참여했습니다/ })).toBeVisible();
  await ownerPage.getByRole("button", { name: "전체", exact: true }).click();

  await ownerPage.getByRole("button", { name: "알림 삭제" }).click();
```

- [ ] **Step 2: 사전 조건 기동 확인**

Run: `docker compose ps` (repo 루트) — `dasida-mysql`이 `Up` 상태인지 확인, 아니면 `docker compose up -d`

- [ ] **Step 3: 대상 e2e 실행**

Run: `pnpm --filter web build && pnpm --filter web e2e -- notifications.spec.ts`
Expected: `apps/web/e2e/notifications.spec.ts`의 모든 테스트 PASS (Playwright는 파일 인자와 무관하게 전체 스위트를 돌릴 수 있음 — 그 경우 전체 그린인지 확인)

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/notifications.spec.ts
git commit -m "test: 알림 필터와 안읽음 AND 조합 e2e 추가"
```

---

## 최종 검증 (전체 완료 후)

- [ ] Run: `cd apps/api && ./gradlew test` — 백엔드 전체 테스트 그린 확인
- [ ] Run: `CI=true pnpm --filter web lint` — 프론트 전체 lint 통과 확인
- [ ] Run: `CI=true pnpm --filter web exec tsc --noEmit` — 프론트 전체 타입 체크 통과 확인
- [ ] Run: `CI=true pnpm --filter web test` — 프론트 vitest 통과 확인
- [ ] Run: `git diff --check` — 공백/충돌 마커 없음 확인

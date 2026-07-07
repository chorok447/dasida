# 알림 타입 필터 탭 + 계정 탭 알림 설정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 알림 페이지에 타입별(의미 단위) 필터 탭 4개를 추가하고, 마이페이지 캠페인 알림 토글을 계정(보안) 탭으로 이동한다.

**Architecture:** 백엔드는 `GET /api/notifications`에 콤마 구분 `types` 쿼리 파라미터를 추가해 `IN` 조건 조회를 지원한다. 프론트는 기존 전체/안읽음 필터 탭 배열을 확장하고, 그룹 id → NotificationType 목록 매핑 테이블로 어떤 필터가 어떤 `types`를 보낼지 결정한다. 캠페인 알림 토글은 `notifications-client.tsx`에서 새 self-contained 컴포넌트로 옮겨 `MypageAccountPanel`에 연결한다.

**Tech Stack:** Kotlin/Spring Boot(MockMvc+H2 통합 테스트), Next.js/React(TS), Playwright e2e.

## Global Constraints

- 커밋 메시지는 한글, AI 서명/공동작성자 표기 금지 (예: `Co-Authored-By: Claude ...` 넣지 않음).
- 기존 API 엔드포인트 경로·기존 파라미터(`page`,`size`,`unreadOnly`)는 변경하지 않고 `types`만 추가한다(하위 호환 유지).
- 기존 응답 envelope(`NotificationsResponse` 필드)은 변경하지 않는다.
- 새 의존성을 추가하지 않는다. 기존 코드 패턴(embedded 폼 컴포넌트, 인라인 스타일 토큰, MockMvc 테스트 스타일)을 그대로 따른다.
- 공용 Switch 컴포넌트를 새로 만들지 않는다 — 기존 인라인 토글 마크업을 그대로 이전한다.
- 푸시/이메일 채널 토글, 이메일 인증(B-4)은 이 플랜 범위 밖이다 — 건드리지 않는다.

---

### Task 1: 백엔드 — `types` 필터 (Repository + Service + Controller)

**Files:**
- Modify: `apps/api/src/main/kotlin/com/dasida/api/notification/NotificationRepository.kt`
- Modify: `apps/api/src/main/kotlin/com/dasida/api/notification/NotificationService.kt:22-38`
- Modify: `apps/api/src/main/kotlin/com/dasida/api/notification/NotificationController.kt:24-30`
- Test: `apps/api/src/test/kotlin/com/dasida/api/notification/NotificationControllerTest.kt`

**Interfaces:**
- Produces: `GET /api/notifications?types=A,B` — `types`가 비어있지 않으면 해당 타입만 조회(우선순위가 `unreadOnly`보다 높음). `NotificationService.getNotifications(userId: Long, page: Int, size: Int, unreadOnly: Boolean, types: List<String> = emptyList())`.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/test/kotlin/com/dasida/api/notification/NotificationControllerTest.kt`의 `list()` 헬퍼(56-62행)를 아래로 교체:

```kotlin
    private fun list(
        unreadOnly: Boolean? = null,
        page: Int? = null,
        size: Int? = null,
        types: List<String>? = null,
        bearer: String? = meToken,
    ) =
        mvc.get("/api/notifications") {
            if (bearer != null) headers { add("Authorization", "Bearer $bearer") }
            if (unreadOnly != null) param("unreadOnly", unreadOnly.toString())
            if (page != null) param("page", page.toString())
            if (size != null) param("size", size.toString())
            if (types != null) param("types", types.joinToString(","))
        }
```

그리고 `unreadOnly 필터와 unreadCount` 테스트(106-122행) 바로 뒤에 새 테스트를 추가:

```kotlin
    @Test
    fun `types 필터는 지정한 타입만 조회하고 unreadOnly보다 우선한다`() {
        save(me, id = "noti-like", type = NotificationType.POST_LIKED, read = true)
        save(me, id = "noti-comment", type = NotificationType.POST_COMMENT_CREATED)
        save(me, id = "noti-follow", type = NotificationType.USER_FOLLOWED)

        list(types = listOf(NotificationType.POST_LIKED, NotificationType.POST_COMMENT_CREATED)).andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(2) }
            jsonPath("$.content[*].id") { value(Matchers.containsInAnyOrder("noti-like", "noti-comment")) }
        }
        // unreadOnly=true 와 types 를 함께 보내도 types 가 우선한다(읽은 noti-like 도 포함됨).
        list(types = listOf(NotificationType.POST_LIKED), unreadOnly = true).andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(1) }
            jsonPath("$.content[0].id") { value("noti-like") }
        }
    }
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd apps/api && ./gradlew test --tests "com.dasida.api.notification.NotificationControllerTest"`
Expected: `types 필터는 지정한 타입만 조회하고 unreadOnly보다 우선한다` FAIL (400 — 존재하지 않는 파라미터 처리 문제는 아니고, 필터링이 안 되어 `content.length()`가 3이라 assertion 실패)

- [ ] **Step 3: Repository에 타입 필터 쿼리 메서드 추가**

`NotificationRepository.kt`의 `interface NotificationRepository` 본문(11-15행) 사이에 추가:

```kotlin
    fun findByUserIdAndTypeIn(userId: Long, types: List<String>, pageable: Pageable): Page<Notification>
```

전체 인터페이스 상단부는 다음과 같이 됨:

```kotlin
interface NotificationRepository : JpaRepository<Notification, String> {
    fun findByUserId(userId: Long, pageable: Pageable): Page<Notification>
    fun findByUserIdAndReadAtIsNull(userId: Long, pageable: Pageable): Page<Notification>
    fun findByUserIdAndTypeIn(userId: Long, types: List<String>, pageable: Pageable): Page<Notification>
    fun countByUserIdAndReadAtIsNull(userId: Long): Long
    fun findByIdAndUserId(id: String, userId: Long): Notification?
```

- [ ] **Step 4: Service에서 types 우선 분기**

`NotificationService.kt`의 `getNotifications` (22-38행)를 교체:

```kotlin
    @Transactional(readOnly = true)
    fun getNotifications(
        userId: Long,
        page: Int,
        size: Int,
        unreadOnly: Boolean,
        types: List<String> = emptyList(),
    ): NotificationsResponse {
        validatePageable(page, size)
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Order.desc("seq"), Sort.Order.asc("id")))
        val result = when {
            types.isNotEmpty() -> repo.findByUserIdAndTypeIn(userId, types, pageable)
            unreadOnly -> repo.findByUserIdAndReadAtIsNull(userId, pageable)
            else -> repo.findByUserId(userId, pageable)
        }
        return NotificationsResponse(
            content = result.content.map { it.toResponse() },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
            unreadCount = repo.countByUserIdAndReadAtIsNull(userId),
        )
    }
```

- [ ] **Step 5: Controller에 types 파라미터 추가**

`NotificationController.kt`의 `list` 메서드(24-30행)를 교체:

```kotlin
    @Operation(summary = "내 알림 목록 조회")
    @GetMapping
    fun list(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @RequestParam(defaultValue = "false") unreadOnly: Boolean,
        @RequestParam(required = false) types: List<String>?,
        @AuthenticationPrincipal user: AuthUser,
    ): NotificationsResponse = service.getNotifications(user.id, page, size, unreadOnly, types ?: emptyList())
```

- [ ] **Step 6: 테스트 실행해서 통과 확인**

Run: `cd apps/api && ./gradlew test --tests "com.dasida.api.notification.NotificationControllerTest"`
Expected: PASS (전체 테스트 그린)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/main/kotlin/com/dasida/api/notification/NotificationRepository.kt apps/api/src/main/kotlin/com/dasida/api/notification/NotificationService.kt apps/api/src/main/kotlin/com/dasida/api/notification/NotificationController.kt apps/api/src/test/kotlin/com/dasida/api/notification/NotificationControllerTest.kt
git commit -m "알림 목록 조회에 타입 필터(types)를 추가한다."
```

---

### Task 2: 프론트 데이터 레이어 — `fetchNotifications`에 types 추가

**Files:**
- Modify: `apps/web/src/data/notifications.ts:51-62`

**Interfaces:**
- Consumes: 없음 (Task 1의 백엔드 API만 의존, 코드 의존 없음)
- Produces: `fetchNotifications(page: number, size: number, unreadOnly: boolean, types?: string[]): Promise<NotificationsResponse>` — Task 3이 이 시그니처를 사용한다.

- [ ] **Step 1: fetchNotifications 시그니처 확장**

`apps/web/src/data/notifications.ts`의 `fetchNotifications` (51-62행)를 교체:

```ts
export function fetchNotifications(
  page: number,
  size: number,
  unreadOnly: boolean,
  types?: string[],
): Promise<NotificationsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    unreadOnly: String(unreadOnly),
  });
  if (types && types.length > 0) params.set("types", types.join(","));
  return apiGet<NotificationsResponse>(`/api/notifications?${params.toString()}`);
}
```

- [ ] **Step 2: 타입 체크로 검증**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 에러 없음 (이 시점엔 아직 새 시그니처를 쓰는 호출부가 없으므로 기존 3-인자 호출도 그대로 컴파일됨)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/data/notifications.ts
git commit -m "fetchNotifications에 타입 필터 파라미터를 추가한다."
```

---

### Task 3: 프론트 UI — 알림 페이지 필터 탭 확장 + 설정 카드 제거

**Files:**
- Modify: `apps/web/src/app/notifications/notifications-client.tsx`

**Interfaces:**
- Consumes: `fetchNotifications(page, size, unreadOnly, types?)` (Task 2)
- Produces: 없음 (leaf UI). `NotificationFilterId` 타입은 이 파일 내부에만 존재.

- [ ] **Step 1: import 정리 — 더 이상 안 쓰는 것 제거**

`notifications-client.tsx` 상단 import 블록에서 아래 부분:

```tsx
import { Bell, CheckCheck, Trash2, Loader2, Settings } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useAuthSession } from "@/lib/use-auth-session";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import { notifyProfileUpdated } from "@/lib/auth";
import { updateProfile } from "@/data/users";
```

를 다음으로 교체(캠페인 알림 토글 관련 4개 import 제거, `Settings` 아이콘 제거):

```tsx
import { Bell, CheckCheck, Trash2, Loader2 } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useAuthSession } from "@/lib/use-auth-session";
```

- [ ] **Step 2: 필터 탭 배열을 타입 그룹 포함하도록 확장**

기존:

```tsx
const filters: { id: "all" | "unread"; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "unread", label: "안 읽음" },
];
```

교체:

```tsx
type NotificationFilterId = "all" | "unread" | "social" | "campaign" | "follow" | "message";

const FILTER_GROUP_TYPES: Partial<Record<NotificationFilterId, string[]>> = {
  social: ["POST_LIKED", "POST_COMMENT_CREATED", "CAMPAIGN_COMMENT_CREATED"],
  campaign: ["CAMPAIGN_JOINED", "CAMPAIGN_PARTICIPATION_REMOVED", "CAMPAIGN_STATUS_CHANGED"],
  follow: ["USER_FOLLOWED"],
  message: ["MESSAGE_RECEIVED"],
};

const filters: { id: NotificationFilterId; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "unread", label: "안 읽음" },
  { id: "social", label: "좋아요·댓글" },
  { id: "campaign", label: "캠페인" },
  { id: "follow", label: "팔로우" },
  { id: "message", label: "메시지" },
];
```

- [ ] **Step 3: 캠페인 알림 토글 관련 state/hook 제거**

기존:

```tsx
  const { sessionId: token, isLoggedIn, hydrated } = useAuthSession();
  const { profile } = useCurrentUserProfile();
  const confirm = useConfirm();

  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const [savingNotify, setSavingNotify] = useState(false);
  const [result, setResult] = useState<Result>({ identity: "", status: "success", data: null });
  const [busy, setBusy] = useState(false); // 모두 읽음 in-flight (중복 클릭 방지)
  const [cleaningRead, setCleaningRead] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set()); // 개별 읽음 in-flight
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState("");

  const generationRef = useRef(0);
  const campaignNotify = profile?.notifyCampaignUpdates ?? true;

  const toggleCampaignNotify = async () => {
    if (!profile || savingNotify) return;
    const next = !campaignNotify;
    setSavingNotify(true);
    try {
      await updateProfile({ name: profile.name, profileImageUrl: profile.profileImageUrl ?? null, notifyCampaignUpdates: next });
      notifyProfileUpdated();
    } catch {
      toast.error("알림 설정을 저장하지 못했습니다.");
    } finally {
      setSavingNotify(false);
    }
  };
```

교체:

```tsx
  const { sessionId: token, isLoggedIn, hydrated } = useAuthSession();
  const confirm = useConfirm();

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
```

- [ ] **Step 4: fetch 호출에 types 전달**

기존:

```tsx
    fetchNotifications(page, PAGE_SIZE, filter === "unread")
```

교체:

```tsx
    fetchNotifications(page, PAGE_SIZE, filter === "unread", FILTER_GROUP_TYPES[filter])
```

- [ ] **Step 5: changeFilter 시그니처 갱신**

기존:

```tsx
  const changeFilter = (next: "all" | "unread") => {
```

교체:

```tsx
  const changeFilter = (next: NotificationFilterId) => {
```

- [ ] **Step 6: 2단 그리드 + 설정 사이드바(aside) 제거, 단일 컬럼으로 정리**

기존 (본문 리스트를 감싸던 grid wrapper 시작부):

```tsx
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-8 lg:items-start">
          <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
```

교체:

```tsx
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
```

그리고 파일 끝부분, Pagination 이후 aside와 닫는 div들:

```tsx
        {!loading && !error && totalPages > 1 ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalElements={data?.totalElements}
            compact
            className="mt-8"
            onPageChange={setPage}
          />
        ) : null}
          </div>

          <aside className="hidden lg:block">
            <div
              className="rounded-2xl border p-5 sticky top-24"
              style={{ background: cardBg, borderColor: cardBorder }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Settings size={14} style={{ color: "var(--accent)" }} aria-hidden />
                <h2 className="text-[18px]" style={{ fontFamily: "'Black Han Sans', sans-serif", color: fg }}>
                  알림 설정
                </h2>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[13px]" style={{ color: fg }}>캠페인 알림</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={campaignNotify}
                  disabled={!profile || savingNotify}
                  onClick={toggleCampaignNotify}
                  className="w-10 h-5 rounded-full p-0.5 transition-colors disabled:opacity-40"
                  style={{
                    background: campaignNotify
                      ? "var(--accent)"
                      : dark
                        ? "rgba(255,255,255,0.15)"
                        : "rgba(28,64,68,0.15)",
                  }}
                >
                  <motion.div
                    animate={{ x: campaignNotify ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    className="w-4 h-4 rounded-full bg-white"
                  />
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
```

교체:

```tsx
        {!loading && !error && totalPages > 1 ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalElements={data?.totalElements}
            compact
            className="mt-8"
            onPageChange={setPage}
          />
        ) : null}
      </div>
    </PageShell>
  );
}
```

(주의: 이 파일에는 `cardBg`/`cardBorder`가 `NotificationRow`에도 쓰이므로 그대로 둔다. `dark` 변수도 필터 탭 배경 등에 계속 쓰이므로 유지한다.)

- [ ] **Step 7: 타입 체크로 검증**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 에러 없음 (미사용 import/변수 없어야 함 — `profile`, `savingNotify`, `campaignNotify`, `toggleCampaignNotify`, `Settings`, `updateProfile`, `notifyProfileUpdated`, `useCurrentUserProfile` 참조가 파일에 전혀 안 남아있는지 확인)

- [ ] **Step 8: lint로 미사용 import 확인**

Run: `pnpm --filter web lint -- src/app/notifications/notifications-client.tsx`
Expected: 에러 없음

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/notifications/notifications-client.tsx
git commit -m "알림 페이지에 타입별 필터 탭을 추가하고 설정 카드를 제거한다."
```

---

### Task 4: 프론트 UI — 계정 탭 알림 설정 컴포넌트

**Files:**
- Create: `apps/web/src/app/mypage/notification-settings-form.tsx`
- Modify: `apps/web/src/app/mypage/mypage-account-panel.tsx`

**Interfaces:**
- Produces: `NotificationSettingsForm({ embedded }: { embedded?: boolean })` — Task 5 e2e가 `getByRole("region", { name: "알림 설정" })`로 이 컴포넌트를 찾는다. 토글은 `role="switch"`, `aria-checked` 속성으로 상태 노출.

- [ ] **Step 1: NotificationSettingsForm 컴포넌트 작성**

`apps/web/src/app/mypage/notification-settings-form.tsx` 새로 생성:

```tsx
"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import { notifyProfileUpdated } from "@/lib/auth";
import { updateProfile } from "@/data/users";

export function NotificationSettingsForm({ embedded = false }: { embedded?: boolean }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const { profile } = useCurrentUserProfile();
  const [saving, setSaving] = useState(false);
  const campaignNotify = profile?.notifyCampaignUpdates ?? true;

  const toggle = async () => {
    if (!profile || saving) return;
    const next = !campaignNotify;
    setSaving(true);
    try {
      await updateProfile({
        name: profile.name,
        profileImageUrl: profile.profileImageUrl ?? null,
        notifyCampaignUpdates: next,
      });
      notifyProfileUpdated();
    } catch {
      toast.error("알림 설정을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className={embedded ? undefined : "mx-auto mb-6 max-w-5xl px-6 sm:px-8"}
      aria-labelledby="notification-settings-title"
    >
      <div
        className="rounded-3xl border p-5 sm:p-7"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7dd3a3]/15 text-[#7dd3a3]">
            <Bell size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id="notification-settings-title" className="text-[17px] font-semibold" style={{ color: "var(--foreground)" }}>
              알림 설정
            </h2>
            <p className="mt-0.5 text-[12px] opacity-60" style={{ color: "var(--foreground)" }}>
              캠페인 관련 알림 수신 여부를 설정합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between py-2.5">
          <span className="text-[13px]" style={{ color: "var(--foreground)" }}>캠페인 알림</span>
          <button
            type="button"
            role="switch"
            aria-checked={campaignNotify}
            disabled={!profile || saving}
            onClick={toggle}
            className="w-10 h-5 rounded-full p-0.5 transition-colors disabled:opacity-40"
            style={{
              background: campaignNotify
                ? "var(--accent)"
                : dark
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(28,64,68,0.15)",
            }}
          >
            <motion.div
              animate={{ x: campaignNotify ? 20 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="w-4 h-4 rounded-full bg-white"
            />
          </button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: MypageAccountPanel에 연결**

`apps/web/src/app/mypage/mypage-account-panel.tsx` 전체 교체:

```tsx
"use client";

import { ChangeEmailForm } from "./change-email-form";
import { ChangePasswordForm } from "./change-password-form";
import { DeleteAccountForm } from "./delete-account-form";
import { NotificationSettingsForm } from "./notification-settings-form";

export function MypageAccountPanel({
  currentEmail,
  profileName,
  onEmailChanged,
}: {
  currentEmail: string;
  profileName: string;
  onEmailChanged: (email: string) => void;
}) {
  return (
    <div className="space-y-6">
      <ChangeEmailForm embedded currentEmail={currentEmail} onChanged={onEmailChanged} />
      <ChangePasswordForm embedded profileName={profileName} />
      <NotificationSettingsForm embedded />
      <DeleteAccountForm embedded />
    </div>
  );
}
```

- [ ] **Step 3: 타입 체크로 검증**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/mypage/notification-settings-form.tsx apps/web/src/app/mypage/mypage-account-panel.tsx
git commit -m "캠페인 알림 토글을 마이페이지 계정 탭으로 이동한다."
```

---

### Task 5: E2E 테스트 — 필터 탭 + 계정 탭 토글

**Files:**
- Modify: `apps/web/e2e/notifications.spec.ts`
- Modify: `apps/web/e2e/account-settings.spec.ts`

**Interfaces:**
- Consumes: Task 3의 필터 탭 라벨(`전체`/`캠페인`/`팔로우`), Task 4의 `NotificationSettingsForm`(`region` 이름 "알림 설정", `role="switch"`).

- [ ] **Step 1: 알림 페이지 e2e에 필터 탭 검증 추가**

`apps/web/e2e/notifications.spec.ts`의 `"캠페인 참여 시 개설자에게 알림이 생성되고 읽음·삭제할 수 있다"` 테스트에서 아래 블록:

```ts
  await ownerPage.goto("/notifications");
  await expect(ownerPage.getByRole("heading", { name: /알림 \(1\)/ })).toBeVisible();
  await expect(ownerPage.getByRole("link", { name: /캠페인에 참여했습니다/ })).toBeVisible();

  await ownerPage.getByRole("button", { name: "읽음으로 표시" }).click();
```

를 아래로 교체 (필터 탭 검증 3줄 삽입):

```ts
  await ownerPage.goto("/notifications");
  await expect(ownerPage.getByRole("heading", { name: /알림 \(1\)/ })).toBeVisible();
  await expect(ownerPage.getByRole("link", { name: /캠페인에 참여했습니다/ })).toBeVisible();

  // 타입별 필터 탭: 관련 없는 그룹에서는 안 보이고, 캠페인 그룹에서는 보인다.
  await ownerPage.getByRole("button", { name: "팔로우", exact: true }).click();
  await expect(ownerPage.getByText("알림이 없습니다.")).toBeVisible();
  await ownerPage.getByRole("button", { name: "캠페인", exact: true }).click();
  await expect(ownerPage.getByRole("link", { name: /캠페인에 참여했습니다/ })).toBeVisible();
  await ownerPage.getByRole("button", { name: "전체", exact: true }).click();

  await ownerPage.getByRole("button", { name: "읽음으로 표시" }).click();
```

- [ ] **Step 2: 계정 탭 알림 설정 e2e 추가**

`apps/web/e2e/account-settings.spec.ts` 맨 마지막 `test(...)` 블록 뒤(파일 끝, 88행 이후)에 추가:

```ts

test("계정 탭 알림 설정에서 캠페인 알림을 끄면 새로고침해도 유지된다", async ({ page }) => {
  await signup(page, "e2e-notify");

  await page.goto("/mypage?tab=account");
  const section = page.getByRole("region", { name: "알림 설정" });
  const toggle = section.getByRole("switch");
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  await page.reload();
  await expect(page.getByRole("region", { name: "알림 설정" }).getByRole("switch")).toHaveAttribute(
    "aria-checked",
    "false",
  );
});
```

- [ ] **Step 3: 사전 조건 기동**

Run: `docker compose up -d` (repo 루트에서, 이미 떠 있으면 스킵)
Run: `cd apps/api && ./gradlew bootRun` (별도 터미널, 이미 떠 있으면 스킵)
Run: `pnpm --filter web build && pnpm --filter web start` (별도 터미널, 이미 떠 있으면 스킵)

- [ ] **Step 4: 대상 e2e만 실행**

Run: `pnpm e2e -- notifications.spec.ts account-settings.spec.ts`
Expected: 두 파일의 모든 테스트 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/e2e/notifications.spec.ts apps/web/e2e/account-settings.spec.ts
git commit -m "알림 필터 탭과 계정 탭 알림 설정 e2e를 추가한다."
```

---

## 최종 검증 (전체 완료 후)

- [ ] Run: `cd apps/api && ./gradlew test` — 백엔드 전체 테스트 그린 확인
- [ ] Run: `pnpm --filter web lint` — 프론트 전체 lint 통과 확인
- [ ] Run: `pnpm --filter web exec tsc --noEmit` — 프론트 전체 타입 체크 통과 확인
- [ ] Run: `git diff --check` — 공백/충돌 마커 없음 확인

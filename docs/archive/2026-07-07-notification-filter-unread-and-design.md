# 알림 필터(타입 탭) + 안읽음 조합(AND)

## 배경

`feat/notification-expansion`(PR #255, develop 머지됨)에서 알림 페이지에 타입 그룹 탭(전체/좋아요·댓글/캠페인/팔로우/메시지/안읽음)을 추가했지만 단일 선택(라디오형)이라 "캠페인 중 안읽은 것만" 같은 조합 조회가 불가능했다. 이번 작업은 그 조합을 가능하게 한다.

## 범위

### UI

- 필터 탭에서 "안 읽음" 탭을 제거한다. 남는 탭: 전체 / 좋아요·댓글 / 캠페인 / 팔로우 / 메시지 (5개, 계속 단일 선택).
- 탭 줄 옆에 "안읽음만 보기" 체크박스/토글을 독립적으로 추가한다. 어떤 타입 탭이 선택돼 있든 켜고 끌 수 있다.
- 타입 탭 또는 안읽음 토글 중 하나라도 바뀌면 `page`를 0으로 리셋한다(기존 규칙 유지).

### 백엔드

`NotificationService.getNotifications`의 분기를 "types 우선(둘 중 하나)"에서 "AND 조합"으로 바꾼다:

```kotlin
val result = when {
    types.isNotEmpty() && unreadOnly -> repo.findByUserIdAndTypeInAndReadAtIsNull(userId, types, pageable)
    types.isNotEmpty() -> repo.findByUserIdAndTypeIn(userId, types, pageable)
    unreadOnly -> repo.findByUserIdAndReadAtIsNull(userId, pageable)
    else -> repo.findByUserId(userId, pageable)
}
```

`NotificationRepository`에 `findByUserIdAndTypeInAndReadAtIsNull(userId, types, pageable)`를 추가한다. `GET /api/notifications`의 파라미터(`page`/`size`/`unreadOnly`/`types`)는 그대로이고 의미만 바뀐다.

### 프론트

- `notifications-client.tsx`의 `filter` state를 타입 전용(`"all" | "social" | "campaign" | "follow" | "message"`)으로 좁히고, `unreadOnly: boolean` state를 별도로 둔다.
- `fetchNotifications(page, PAGE_SIZE, unreadOnly, FILTER_GROUP_TYPES[filter])` 형태로 호출한다.
- 빈 상태 문구는 `unreadOnly` 값 기준으로 분기한다(기존 `filter === "unread"` 삼항 조건을 `unreadOnly`로 교체). 그룹 탭 전용 문구는 만들지 않는다(기존 방침 유지).

## 데이터 흐름

타입 탭 클릭 또는 안읽음 토글 클릭 → 두 state 중 해당하는 것만 갱신 → `page` 0으로 리셋 → `fetchNotifications`가 최신 두 값을 함께 전달 → 백엔드가 AND 조건으로 페이지네이션된 결과 반환.

## 에러 처리

기존 에러 상태(`StatePanel` + 다시 시도 버튼)를 그대로 재사용한다. 새로운 에러 케이스는 없다.

## 테스트

- 백엔드: `types` + `unreadOnly`를 동시에 보냈을 때 AND로 좁혀지는지 검증하는 테스트로 기존 "우선순위" 테스트를 교체한다.
- e2e: 캠페인 탭 선택 + 안읽음 토글 on을 함께 적용했을 때 결과가 좁혀지는 시나리오 1개를 추가한다.

## 제외 사항

- 타입 탭 다중 선택(여러 그룹 동시 선택)은 범위 밖 — 타입 탭은 계속 단일 선택이다.
- 그룹별 전용 빈 상태 문구는 만들지 않는다.

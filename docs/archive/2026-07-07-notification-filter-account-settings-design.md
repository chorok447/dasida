# 알림 타입 필터 탭 + 계정 탭 알림 설정 (Phase B-3 잔여)

## 배경

`feat/notification-expansion` 브랜치에서 게시글 좋아요·캠페인 상태 변경 알림, 캠페인 알림 끄기까지는 구현됨. 남은 B-3 항목 중 이번 스코프는 아래 두 가지:

1. 알림 필터 탭 (현재 전체/안읽음만 존재, 타입별 필터 없음)
2. 마이페이지 계정 탭에 알림 설정 노출

B-4(이메일 인증)와 푸시/이메일 채널 토글은 이번 스코프에서 제외 — 프로젝트에 이메일/웹푸시 발송 인프라가 전혀 없어 별도 인프라 결정이 필요하기 때문 (사용자 확인 완료).

## 범위

### 1. 알림 필터 탭 (의미 단위 그룹)

기존 탭: 전체 / 안읽음. 아래 4개 그룹 탭 추가, 기존과 동일하게 단일 선택(라디오형), 안읽음과 조합하지 않음.

| 탭 id | 라벨 | NotificationType |
|---|---|---|
| social | 좋아요·댓글 | `POST_LIKED`, `POST_COMMENT_CREATED`, `CAMPAIGN_COMMENT_CREATED` |
| campaign | 캠페인 | `CAMPAIGN_JOINED`, `CAMPAIGN_PARTICIPATION_REMOVED`, `CAMPAIGN_STATUS_CHANGED` |
| follow | 팔로우 | `USER_FOLLOWED` |
| message | 메시지 | `MESSAGE_RECEIVED` |

**백엔드**
- `GET /api/notifications`에 `types`(콤마 구분 `List<String>`, optional) 쿼리 파라미터 추가.
- `NotificationRepository`: `findByUserIdAndTypeIn(userId, types, pageable)` 추가.
- `NotificationService.getNotifications(userId, page, size, unreadOnly, types)`: `types`가 비어있지 않으면 type-in 쿼리 사용, `unreadOnly`는 무시(프론트가 둘을 동시에 보내지 않음).

**프론트**
- `data/notifications.ts`의 `fetchNotifications`에 `types?: string[]` 인자 추가, 쿼리스트링에 `types=A,B,C`로 직렬화.
- `notifications-client.tsx`: `filter` state 타입을 `"all" | "unread" | "social" | "campaign" | "follow" | "message"`로 확장. 그룹→types 매핑 테이블(`FILTER_GROUPS`)을 두고 `fetchNotifications` 호출 시 분기.
- 그룹 탭의 빈 목록 카피는 전체/안읽음과 동일한 기본 문구 재사용(그룹별 전용 문구 없음 — YAGNI).

### 2. 캠페인 알림 토글 → 계정 탭

- `notifications-client.tsx`의 우측 사이드바 "알림 설정" 카드(토글) 제거.
- 신규 파일 `apps/web/src/app/mypage/notification-settings-form.tsx`: `DeleteAccountForm`과 같은 self-contained `embedded` 컴포넌트 패턴. 내부에서 `useCurrentUserProfile` + `data/users.ts`의 `updateProfile`을 직접 호출(부모로부터 props 안 받음).
- 토글 UI/스타일은 기존 `notifications-client.tsx`의 인라인 마크업(motion 애니메이션 포함)을 그대로 재사용 — 코드베이스에 공용 Switch 컴포넌트가 없으므로 새로 만들지 않음.
- `MypageAccountPanel`에 `<NotificationSettingsForm embedded />` 추가(계정/보안 탭, 기존 이메일/비번/탈퇴 폼과 같은 위치에).

## 데이터 흐름

- 필터 탭 클릭 → `filter` state 변경 → `page` 0으로 리셋 → `fetchNotifications(page, size, unreadOnly, types)` 재호출 → 백엔드가 `types IN (...)` 조건으로 페이지네이션된 결과 반환. 기존 페이지네이션/무한스크롤 로직 변경 없음(쿼리 조건만 추가).
- 계정 탭 토글 → `updateProfile({..., notifyCampaignUpdates: next})` → `notifyProfileUpdated()` 이벤트로 프로필 캐시 갱신(기존 패턴과 동일, 알림 페이지 쪽 로직 변경 없음).

## 에러 처리

- 필터 API 실패 시 기존 에러 상태(`StatePanel` + 다시 시도 버튼) 그대로 재사용.
- 계정 탭 토글 실패 시 기존 `toast.error("알림 설정을 저장하지 못했습니다.")` 그대로 재사용.

## 테스트

- 백엔드: `NotificationService`(또는 controller) 테스트에 `types` 필터 케이스 1개 추가 (예: campaign 타입만 조회 시 다른 타입 알림 안 섞임).
- 프론트 e2e: 알림 페이지에서 그룹 탭 클릭 시 해당 타입만 보이는 시나리오 1개, 계정 탭에서 토글이 동작하는 시나리오 1개 추가(기존 알림 설정 e2e를 계정 탭 기준으로 이동/수정).

## 제외 사항 (의도적으로 하지 않음)

- 푸시/이메일 채널 토글 UI 및 백엔드 필드 — 전달 인프라 없음, 이번 스코프 제외.
- 이메일 인증 플로우(B-4) — 별도 스코프.
- 필터 탭과 안읽음의 조합(AND) — 요청 범위 밖.

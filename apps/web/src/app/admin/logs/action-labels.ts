import type { AdminActionType } from "@/data/admin";

// 감사 로그 화면과 대시보드 최근 조치가 공유하는 라벨.
export const ACTION_LABELS: Record<AdminActionType, string> = {
  REPORT_RESOLVED: "신고 조치 완료",
  REPORT_DISMISSED: "신고 기각",
  CONTENT_HIDDEN: "콘텐츠 숨김",
  CONTENT_RESTORED: "콘텐츠 복구",
  USER_SUSPENDED: "회원 정지",
  USER_UNSUSPENDED: "정지 해제",
};

/** 제재 성격의 조치는 경고색, 되돌리는 조치는 보통색으로 구분한다. */
export const RESTRICTIVE_ACTIONS: ReadonlySet<AdminActionType> = new Set([
  "REPORT_RESOLVED",
  "CONTENT_HIDDEN",
  "USER_SUSPENDED",
]);

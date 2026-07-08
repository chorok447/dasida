// 알림은 백엔드(/api/notifications, 인증 필수)가 source of truth. 사용자별 데이터.
import { apiDelete, apiGet, apiPost } from "@/lib/api";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  readAt: string | null;
  createdAt?: string | null;
  time: string;
};

export type NotificationsResponse = {
  content: NotificationItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  unreadCount: number;
};

export type NotificationUnreadCountResponse = {
  unreadCount: number;
};

export type NotificationReadAllResponse = {
  updatedCount: number;
  unreadCount: number;
};

export type NotificationDeleteResponse = {
  deleted: boolean;
  unreadCount: number;
};

export type NotificationDeleteReadResponse = {
  deletedCount: number;
  unreadCount: number;
};

// 읽음 처리 후 헤더 badge 가 다시 조회하도록 알리는 이벤트(auth 이벤트와 별개).
// WS 로 unreadCount 가 실려 오면 detail 에 담아 재조회 없이 배지를 갱신한다.
export const NOTIF_EVENT = "dasida-notif";

export type NotifChangedDetail = {
  unreadCount?: number;
};

export function emitNotificationsChanged(detail?: NotifChangedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NotifChangedDetail>(NOTIF_EVENT, { detail }));
}

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

export function fetchNotificationUnreadCount(): Promise<NotificationUnreadCountResponse> {
  return apiGet<NotificationUnreadCountResponse>("/api/notifications/unread-count");
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  const res = await apiPost<NotificationItem>(`/api/notifications/${id}/read`, {});
  emitNotificationsChanged();
  return res;
}

export async function markAllNotificationsRead(): Promise<NotificationReadAllResponse> {
  const res = await apiPost<NotificationReadAllResponse>("/api/notifications/read-all", {});
  emitNotificationsChanged();
  return res;
}

export async function deleteNotification(
  id: string,
): Promise<NotificationDeleteResponse> {
  const res = await apiDelete<NotificationDeleteResponse>(`/api/notifications/${id}`);
  emitNotificationsChanged();
  return res;
}

export async function deleteReadNotifications(
): Promise<NotificationDeleteReadResponse> {
  const res = await apiDelete<NotificationDeleteReadResponse>("/api/notifications/read");
  emitNotificationsChanged();
  return res;
}

/** createdAt 으로 상대시간 라벨 생성. 없으면 저장된 time 스냅샷 fallback. */
export function relativeTime(item: Pick<NotificationItem, "createdAt" | "time">): string {
  if (!item.createdAt) return item.time;
  const then = new Date(item.createdAt).getTime();
  if (Number.isNaN(then)) return item.time;
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(then).toLocaleDateString("ko-KR");
}

export function notificationTypeLabel(type: string): string {
  if (type === "CAMPAIGN_JOINED") return "캠페인 참여";
  if (type === "USER_FOLLOWED") return "새 팔로워";
  if (type === "MESSAGE_RECEIVED") return "새 메시지";
  if (type === "POST_COMMENT_CREATED") return "게시글 댓글";
  if (type === "CAMPAIGN_COMMENT_CREATED") return "캠페인 댓글";
  if (type === "POST_LIKED") return "게시글 좋아요";
  if (type === "CAMPAIGN_STATUS_CHANGED") return "캠페인 상태";
  if (type === "REPORT_RESOLVED") return "신고 처리";
  if (type === "CONTENT_HIDDEN") return "콘텐츠 숨김";
  if (type === "CONTENT_RESTORED") return "숨김 해제";
  return "알림";
}

export function isNotificationNavigable(href: string): boolean {
  const trimmed = href.trim();
  return trimmed.startsWith("/") && trimmed.length > 1;
}

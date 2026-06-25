// 알림 데이터는 백엔드(GET /api/notifications)가 source of truth. 타입만 유지.
export type NotifKind = "like" | "comment" | "campaign" | "system";

export type Notification = {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  thumb?: string;
};

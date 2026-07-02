import NotificationsClient from "./notifications-client";

// 알림은 사용자별(인증 필수) 데이터라 SSR 로 미리 받지 않고 클라이언트에서 토큰으로 조회한다.
export default function NotificationsPage() {
  return <NotificationsClient />;
}

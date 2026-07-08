import DashboardClient from "./dashboard-client";

// 관리자 통계는 인증(ROLE_ADMIN) 필수 데이터라 SSR 로 받지 않고 클라이언트에서 조회한다.
export default function AdminPage() {
  return <DashboardClient />;
}

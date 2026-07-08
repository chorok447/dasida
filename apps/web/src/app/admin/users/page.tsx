import UsersClient from "./users-client";

// 회원 목록은 관리자 전용(인증 필수) 데이터라 SSR 없이 클라이언트에서 조회한다.
export default function AdminUsersPage() {
  return <UsersClient />;
}

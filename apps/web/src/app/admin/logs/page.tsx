import LogsClient from "./logs-client";

// 감사 로그는 관리자 전용(인증 필수) 데이터라 SSR 없이 클라이언트에서 조회한다.
export default function AdminLogsPage() {
  return <LogsClient />;
}

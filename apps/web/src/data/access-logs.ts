import { apiGet } from "@/lib/api";

export type AccessLogItem = {
  id: number;
  ipAddress: string;
  os: string;
  /** User-Agent 파싱 결과. 수집 이전 기록은 null. */
  browser: string | null;
  /** IP 기반의 대략적 위치. 조회 실패·사설 IP·수집 이전 기록은 null. */
  country: string | null;
  region: string | null;
  accessedAt: string;
};

export type AccessLogPageResponse = {
  content: AccessLogItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

const PAGE_SIZE = 15;

export function fetchAccessLogsPage(page: number): Promise<AccessLogPageResponse> {
  const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
  return apiGet<AccessLogPageResponse>(`/api/auth/access-logs?${params}`);
}

import { apiGet } from "@/lib/api";

export type AccessLogItem = {
  id: number;
  ipAddress: string;
  os: string;
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

import { apiGet, apiPost } from "@/lib/api";

export type ReportTargetType =
  | "POST"
  | "POST_COMMENT"
  | "CAMPAIGN"
  | "CAMPAIGN_COMMENT";

export type ReportReason =
  | "SPAM"
  | "ABUSE"
  | "INAPPROPRIATE"
  | "SCAM"
  | "OTHER";

export type CreateReportRequest = {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail?: string | null;
};

export type ReportItem = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail: string | null;
  time: string;
};

export type ReportsPageResponse = {
  content: ReportItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: "스팸/광고",
  ABUSE: "욕설/괴롭힘",
  INAPPROPRIATE: "부적절한 내용",
  SCAM: "사기/허위 정보",
  OTHER: "기타",
};

export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  POST: "게시글",
  POST_COMMENT: "게시글 댓글",
  CAMPAIGN: "캠페인",
  CAMPAIGN_COMMENT: "캠페인 댓글",
};

export function createReport(body: CreateReportRequest): Promise<ReportItem> {
  return apiPost<ReportItem>("/api/reports", body);
}

export function fetchMyReports(
  params: { page?: number; size?: number },
): Promise<ReportsPageResponse> {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  });
  return apiGet<ReportsPageResponse>(`/api/reports/mine?${query.toString()}`);
}

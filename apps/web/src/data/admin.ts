import { apiGet, apiPatch } from "@/lib/api";
import type { ReportReason, ReportStatus, ReportTargetType } from "@/data/reports";

export type AdminSummary = {
  users: number;
  posts: number;
  campaigns: number;
  pendingReports: number;
  totalReports: number;
};

export type AdminReportTarget = {
  excerpt: string;
  authorName: string;
  href: string;
  hidden: boolean;
};

export type AdminReportItem = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail: string | null;
  time: string;
  status: ReportStatus;
  resolutionNote: string | null;
  resolvedAt: string | null;
  reporter: { id: number; name: string; email: string | null };
  /** 대상이 이미 삭제됐으면 null */
  target: AdminReportTarget | null;
  targetReportCount: number;
};

export type AdminReportsPageResponse = {
  content: AdminReportItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  pendingCount: number;
};

export function fetchAdminSummary(): Promise<AdminSummary> {
  return apiGet<AdminSummary>("/api/admin/summary");
}

export function fetchAdminReports(params: {
  status?: ReportStatus | "";
  targetType?: ReportTargetType | "";
  page?: number;
  size?: number;
}): Promise<AdminReportsPageResponse> {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  });
  if (params.status) query.set("status", params.status);
  if (params.targetType) query.set("targetType", params.targetType);
  return apiGet<AdminReportsPageResponse>(`/api/admin/reports?${query.toString()}`);
}

export function resolveAdminReport(
  reportId: string,
  body: { status: Exclude<ReportStatus, "PENDING">; note?: string; hideContent?: boolean },
): Promise<AdminReportItem> {
  return apiPatch<AdminReportItem>(`/api/admin/reports/${reportId}`, body);
}

export type ContentVisibilityResponse = {
  targetType: ReportTargetType;
  targetId: string;
  hidden: boolean;
};

/** 콘텐츠 숨김(soft hide)/복구. 작성자에게 알림이 발송된다. */
export function setAdminContentVisibility(
  targetType: ReportTargetType,
  targetId: string,
  body: { hidden: boolean; reason?: string },
): Promise<ContentVisibilityResponse> {
  return apiPatch<ContentVisibilityResponse>(
    `/api/admin/content/${targetType}/${encodeURIComponent(targetId)}`,
    body,
  );
}

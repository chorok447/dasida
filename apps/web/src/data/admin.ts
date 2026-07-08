import { apiGet, apiPatch } from "@/lib/api";
import type { ReportReason, ReportStatus, ReportTargetType } from "@/data/reports";

export type AdminSummary = {
  users: number;
  posts: number;
  campaigns: number;
  pendingReports: number;
  totalReports: number;
  suspendedUsers: number;
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

export type AdminUserItem = {
  id: number;
  email: string;
  name: string;
  verified: boolean;
  role: "USER" | "ADMIN";
  deleted: boolean;
  suspended: boolean;
  suspendedUntil: string | null;
  suspendedReason: string | null;
  postCount: number;
  campaignCount: number;
};

export type AdminUsersPageResponse = {
  content: AdminUserItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export function fetchAdminUsers(params: {
  q?: string;
  suspended?: boolean;
  page?: number;
  size?: number;
}): Promise<AdminUsersPageResponse> {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  });
  if (params.q) query.set("q", params.q);
  if (params.suspended) query.set("suspended", "true");
  return apiGet<AdminUsersPageResponse>(`/api/admin/users?${query.toString()}`);
}

/** 회원 정지(suspendedUntil 미래 시각) 또는 해제(null). 로그인·기존 토큰이 즉시 차단된다. */
export function setAdminUserSuspension(
  userId: number,
  body: { suspendedUntil: string | null; reason?: string },
): Promise<AdminUserItem> {
  return apiPatch<AdminUserItem>(`/api/admin/users/${userId}/suspension`, body);
}

export type AdminActionType =
  | "REPORT_RESOLVED"
  | "REPORT_DISMISSED"
  | "CONTENT_HIDDEN"
  | "CONTENT_RESTORED"
  | "USER_SUSPENDED"
  | "USER_UNSUSPENDED";

export type AdminActionLogItem = {
  id: number;
  action: AdminActionType;
  /** REPORT/USER 또는 콘텐츠 타입(POST, POST_COMMENT, CAMPAIGN, CAMPAIGN_COMMENT) */
  targetType: string;
  targetId: string;
  /** 처리 메모/숨김 사유/정지 기간·사유 */
  detail: string | null;
  createdAt: string;
  admin: { id: number; name: string; email: string | null };
};

export type AdminActionLogsPageResponse = {
  content: AdminActionLogItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export function fetchAdminLogs(params: {
  action?: AdminActionType | "";
  page?: number;
  size?: number;
}): Promise<AdminActionLogsPageResponse> {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  });
  if (params.action) query.set("action", params.action);
  return apiGet<AdminActionLogsPageResponse>(`/api/admin/logs?${query.toString()}`);
}

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

"use client";

import { StaggerItem } from "@/components/scroll-reveal";
import Link from "next/link";
import { FileWarning, Flag } from "lucide-react";
import { StatePanel } from "@/components/ui/state-panel";
import {
  fetchMyReports,
  REPORT_REASON_LABELS,
  REPORT_TARGET_LABELS,
  type ReportItem,
} from "@/data/reports";
import { getToken } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { useTheme } from "@/lib/theme-context";
import { PaginatedSection } from "./paginated-section";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function targetHref(report: ReportItem): string | null {
  if (report.targetType === "POST") return `/posts/${report.targetId}`;
  if (report.targetType === "CAMPAIGN") return `/campaigns/${report.targetId}`;
  return null;
}

function ReportCard({ report }: { report: ReportItem }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const href = targetHref(report);
  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#7dd3a3]/15 px-2.5 py-1 text-[11px] text-[#148a90]">
            {REPORT_TARGET_LABELS[report.targetType]}
          </span>
          <span className="rounded-full bg-[#ed5c48]/10 px-2.5 py-1 text-[11px] text-[#b3402f]">
            {REPORT_REASON_LABELS[report.reason]}
          </span>
        </div>
        <time dateTime={report.time} className="text-[11px] opacity-55">{formatTime(report.time)}</time>
      </div>
      {report.detail ? <p className="mt-3 line-clamp-3 break-words text-[13px] leading-6 opacity-75">{report.detail}</p> : null}
      <p className="mt-3 truncate text-[11px] opacity-45">대상 ID: {report.targetId}</p>
    </>
  );

  const className = "block rounded-2xl border p-5 text-left shadow-[0_18px_42px_-28px_rgba(0,0,0,0.45)] transition-[transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3a3]";
  const style = {
    background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
    borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
    color: dark ? "#f9f7f2" : "#0f1f22",
  };

  return href ? (
    <Link href={href} className={`${className} hover:-translate-y-0.5 hover:shadow-lg`} style={style}>
      {content}
    </Link>
  ) : (
    <article className={className} style={style}>{content}</article>
  );
}

export function ReportsList({ page, onPageChange }: { page: number; onPageChange: (page: number) => void }) {
  return (
    <PaginatedSection<ReportItem>
      identityKey="reports"
      page={page}
      onPageChange={onPageChange}
      fetcher={(currentPage) => {
        const token = getToken();
        return token
          ? fetchMyReports({ page: currentPage, size: 20 }, token)
          : Promise.reject(new ApiError(401, "/api/reports/mine"));
      }}
      loadingLabel="신고 내역을 불러오는 중입니다."
      errorLabel="신고 내역을 불러오지 못했습니다."
      empty={
        <StatePanel className="min-h-64 rounded-2xl">
          <FileWarning size={28} className="text-[#7dd3a3]" />
          <p>신고 내역이 없습니다.</p>
        </StatePanel>
      }
      renderItems={(reports) => (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[13px] opacity-65">
            <Flag size={14} /> 내가 접수한 신고만 표시됩니다.
          </div>
          {reports.map((report, i) => (
            <StaggerItem key={report.id} index={i}>
              <ReportCard report={report} />
            </StaggerItem>
          ))}
        </div>
      )}
    />
  );
}

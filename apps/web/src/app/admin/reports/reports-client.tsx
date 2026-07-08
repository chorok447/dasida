"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ExternalLink, ShieldCheck, ShieldX } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import { ApiError, apiErrorMessage } from "@/lib/api";
import {
  fetchAdminReports,
  resolveAdminReport,
  type AdminReportItem,
  type AdminReportsPageResponse,
} from "@/data/admin";
import {
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_LABELS,
  type ReportStatus,
  type ReportTargetType,
} from "@/data/reports";

const PAGE_SIZE = 20;

const STATUS_TABS: { id: ReportStatus | ""; label: string }[] = [
  { id: "PENDING", label: "대기 중" },
  { id: "RESOLVED", label: "조치 완료" },
  { id: "DISMISSED", label: "기각" },
  { id: "", label: "전체" },
];

const TARGET_OPTIONS = Object.entries(REPORT_TARGET_LABELS) as [ReportTargetType, string][];

type Result = {
  identity: string;
  status: "success" | "error";
  data: AdminReportsPageResponse | null;
};

export default function ReportsClient() {
  // 기본 탭은 대기 중 — 이 화면의 목적이 신고 큐 처리라서다.
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "">("PENDING");
  const [targetFilter, setTargetFilter] = useState<ReportTargetType | "">("");
  const [page, setPage] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const [result, setResult] = useState<Result>({ identity: "", status: "success", data: null });
  const generationRef = useRef(0);

  const requestIdentity = JSON.stringify([statusFilter, targetFilter, page, retryTick]);

  useEffect(() => {
    const generation = ++generationRef.current;
    fetchAdminReports({ status: statusFilter, targetType: targetFilter, page, size: PAGE_SIZE })
      .then((res) => {
        if (generation !== generationRef.current) return;
        if (res.content.length === 0 && page > 0) {
          setPage((currentPage) => Math.max(0, currentPage - 1));
          return;
        }
        setResult({ identity: requestIdentity, status: "success", data: res });
      })
      .catch(() => {
        if (generation !== generationRef.current) return;
        setResult({ identity: requestIdentity, status: "error", data: null });
      });
  }, [requestIdentity, statusFilter, targetFilter, page]);

  const current = result.identity === requestIdentity;
  const loading = !current;
  const error = current && result.status === "error";
  const data = current && result.status === "success" ? result.data : null;
  const list = data?.content ?? [];

  const replaceItem = (updated: AdminReportItem) => {
    setResult((stored) =>
      stored.data
        ? {
            ...stored,
            data: {
              ...stored.data,
              content: stored.data.content.map((item) => (item.id === updated.id ? updated : item)),
              pendingCount: Math.max(0, stored.data.pendingCount - 1),
            },
          }
        : stored,
    );
  };

  return (
    <div className="space-y-6" style={{ color: "var(--foreground)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="신고 상태 필터" className="flex flex-wrap gap-2">
          {STATUS_TABS.map(({ id, label }) => {
            const active = statusFilter === id;
            return (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setStatusFilter(id);
                  setPage(0);
                }}
                className="rounded-full border px-4 py-2 text-[13px] transition-colors"
                style={
                  active
                    ? { background: "var(--accent)", borderColor: "var(--accent)", color: "#0f1f22" }
                    : { background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }
                }
              >
                {label}
                {id === "PENDING" && data ? ` (${data.pendingCount})` : ""}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
          대상
          <select
            value={targetFilter}
            onChange={(e) => {
              setTargetFilter(e.target.value as ReportTargetType | "");
              setPage(0);
            }}
            className="rounded-xl border px-3 py-2 text-[13px]"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <option value="">전체</option>
            {TARGET_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <StatePanel compact aria-busy="true">
          <Loader2 className="animate-spin" size={20} aria-hidden />
          <p>신고 목록을 불러오는 중입니다…</p>
        </StatePanel>
      ) : error ? (
        <StatePanel compact>
          <p>신고 목록을 불러오지 못했습니다.</p>
          <button
            type="button"
            onClick={() => setRetryTick((t) => t + 1)}
            className="rounded-full border px-4 py-2 text-[13px]"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            다시 시도
          </button>
        </StatePanel>
      ) : list.length === 0 ? (
        <StatePanel compact>
          <p>해당 조건의 신고가 없습니다.</p>
        </StatePanel>
      ) : (
        <ul className="space-y-4">
          {list.map((item) => (
            <ReportRow key={item.id} item={item} onResolved={replaceItem} />
          ))}
        </ul>
      )}

      {data && (
        <Pagination
          page={page}
          totalPages={data.totalPages}
          totalElements={data.totalElements}
          disabled={loading}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function ReportRow({
  item,
  onResolved,
}: {
  item: AdminReportItem;
  onResolved: (updated: AdminReportItem) => void;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<ReportStatus | null>(null);
  const pending = item.status === "PENDING";

  const resolve = async (status: "RESOLVED" | "DISMISSED") => {
    if (submitting) return;
    setSubmitting(status);
    try {
      const updated = await resolveAdminReport(item.id, {
        status,
        note: note.trim() || undefined,
      });
      onResolved(updated);
      toast.success(status === "RESOLVED" ? "신고를 조치 완료로 처리했습니다." : "신고를 기각했습니다.");
    } catch (e) {
      toast.error(
        e instanceof ApiError ? apiErrorMessage(e, "신고 처리에 실패했습니다.") : "신고 처리에 실패했습니다.",
      );
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <li
      className="rounded-3xl border p-5"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span
          className="rounded-full px-2.5 py-1"
          style={{ background: "var(--accent-soft)", color: "var(--accent-secondary)" }}
        >
          {REPORT_TARGET_LABELS[item.targetType]}
        </span>
        <span className="rounded-full border px-2.5 py-1" style={{ borderColor: "var(--border)" }}>
          {REPORT_REASON_LABELS[item.reason]}
        </span>
        <StatusBadge status={item.status} />
        {item.targetReportCount > 1 && (
          <span className="rounded-full px-2.5 py-1" style={{ background: "rgba(237,92,72,0.15)", color: "#ed5c48" }}>
            같은 대상 신고 {item.targetReportCount}건
          </span>
        )}
        <span className="ml-auto" style={{ color: "var(--foreground-muted)" }}>
          {item.time}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-[14px]">
        {item.target ? (
          <>
            <p className="break-all">{item.target.excerpt || "(본문 없음)"}</p>
            <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
              작성자: {item.target.authorName} ·{" "}
              <Link href={item.target.href} className="inline-flex items-center gap-1 underline underline-offset-2">
                콘텐츠 보기 <ExternalLink size={12} aria-hidden />
              </Link>
            </p>
          </>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--foreground-muted)" }}>
            삭제되었거나 찾을 수 없는 콘텐츠입니다.
          </p>
        )}
        <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
          신고자: {item.reporter.name}
          {item.reporter.email ? ` (${item.reporter.email})` : ""}
          {item.detail ? ` — “${item.detail}”` : ""}
        </p>
        {!pending && item.resolutionNote && (
          <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
            처리 메모: {item.resolutionNote}
          </p>
        )}
      </div>

      {pending && (
        <div className="mt-4 space-y-3">
          <label className="block text-[12px]" style={{ color: "var(--foreground-muted)" }}>
            처리 메모 (선택, 신고자 알림에 포함)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              className="mt-1 w-full resize-none rounded-xl border px-3 py-2 text-[13px]"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => resolve("RESOLVED")}
              disabled={submitting !== null}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#0f1f22" }}
            >
              {submitting === "RESOLVED" ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <ShieldCheck size={14} aria-hidden />
              )}
              조치 완료
            </button>
            <button
              type="button"
              onClick={() => resolve("DISMISSED")}
              disabled={submitting !== null}
              className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              {submitting === "DISMISSED" ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <ShieldX size={14} aria-hidden />
              )}
              기각
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const style =
    status === "PENDING"
      ? { background: "rgba(237,178,72,0.18)", color: "#b07b1e" }
      : status === "RESOLVED"
        ? { background: "var(--accent-soft)", color: "var(--accent-secondary)" }
        : { background: "var(--surface)", color: "var(--foreground-muted)" };
  return (
    <span className="rounded-full px-2.5 py-1" style={style}>
      {REPORT_STATUS_LABELS[status]}
    </span>
  );
}

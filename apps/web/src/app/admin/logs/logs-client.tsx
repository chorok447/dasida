"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ScrollText } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import { fetchAdminLogs, type AdminActionLogItem, type AdminActionLogsPageResponse, type AdminActionType } from "@/data/admin";
import { REPORT_TARGET_LABELS, type ReportTargetType } from "@/data/reports";

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<AdminActionType, string> = {
  REPORT_RESOLVED: "신고 조치 완료",
  REPORT_DISMISSED: "신고 기각",
  CONTENT_HIDDEN: "콘텐츠 숨김",
  CONTENT_RESTORED: "콘텐츠 복구",
  USER_SUSPENDED: "회원 정지",
  USER_UNSUSPENDED: "정지 해제",
};

/** 제재 성격의 조치는 경고색, 되돌리는 조치는 보통색으로 구분한다. */
const RESTRICTIVE_ACTIONS: ReadonlySet<AdminActionType> = new Set([
  "REPORT_RESOLVED",
  "CONTENT_HIDDEN",
  "USER_SUSPENDED",
]);

function targetLabel(log: AdminActionLogItem): string {
  if (log.targetType === "REPORT") return "신고";
  if (log.targetType === "USER") return "회원";
  return REPORT_TARGET_LABELS[log.targetType as ReportTargetType] ?? log.targetType;
}

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

type Result = { identity: string; status: "success" | "error"; data: AdminActionLogsPageResponse | null };

export default function LogsClient() {
  const [action, setAction] = useState<AdminActionType | "">("");
  const [page, setPage] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const [result, setResult] = useState<Result>({ identity: "", status: "success", data: null });
  const generationRef = useRef(0);

  const requestIdentity = JSON.stringify([action, page, retryTick]);

  useEffect(() => {
    const generation = ++generationRef.current;
    fetchAdminLogs({ action, page, size: PAGE_SIZE })
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
  }, [requestIdentity, action, page]);

  const current = result.identity === requestIdentity;
  const loading = !current;
  const error = current && result.status === "error";
  const data = current && result.status === "success" ? result.data : null;
  const list = data?.content ?? [];

  return (
    <div className="space-y-6" style={{ color: "var(--foreground)" }}>
      <div className="flex items-center gap-2">
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value as AdminActionType | "");
            setPage(0);
          }}
          aria-label="조치 종류 필터"
          className="rounded-xl border px-3 py-2 text-[13px]"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <option value="">전체 조치</option>
          {(Object.entries(ACTION_LABELS) as [AdminActionType, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {data && (
          <span className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
            총 {data.totalElements}건
          </span>
        )}
      </div>

      {loading ? (
        <StatePanel compact aria-busy="true">
          <Loader2 className="animate-spin" size={20} aria-hidden />
          <p>감사 로그를 불러오는 중입니다…</p>
        </StatePanel>
      ) : error ? (
        <StatePanel compact>
          <p>감사 로그를 불러오지 못했습니다.</p>
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
          <ScrollText size={20} aria-hidden style={{ color: "var(--foreground-muted)" }} />
          <p>{action ? `"${ACTION_LABELS[action]}" 조치 기록이 없습니다.` : "아직 관리자 조치 기록이 없습니다."}</p>
        </StatePanel>
      ) : (
        <ul className="space-y-3">
          {list.map((log) => (
            <LogRow key={log.id} log={log} />
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

function LogRow({ log }: { log: AdminActionLogItem }) {
  const restrictive = RESTRICTIVE_ACTIONS.has(log.action);
  return (
    <li className="rounded-3xl border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-2.5 py-1 text-[11px]"
          style={
            restrictive
              ? { background: "rgba(237,92,72,0.14)", color: "#ed5c48" }
              : { background: "var(--accent-soft)", color: "var(--accent-secondary)" }
          }
        >
          {ACTION_LABELS[log.action] ?? log.action}
        </span>
        <span className="text-[13px] font-semibold">{log.admin.name}</span>
        {log.admin.email && (
          <span className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
            {log.admin.email}
          </span>
        )}
        <span className="ml-auto text-[12px]" style={{ color: "var(--foreground-muted)" }}>
          {formatCreatedAt(log.createdAt)}
        </span>
      </div>
      <p className="mt-2 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
        대상: {targetLabel(log)} · <span className="break-all">{log.targetId}</span>
      </p>
      {log.detail && <p className="mt-1 text-[13px]">{log.detail}</p>}
    </li>
  );
}

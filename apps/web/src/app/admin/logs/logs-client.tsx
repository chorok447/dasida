"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, Loader2, ScrollText } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ApiError, apiErrorMessage } from "@/lib/api";
import {
  fetchAdminLogs,
  setAdminContentVisibility,
  type AdminActionLogItem,
  type AdminActionLogsPageResponse,
  type AdminActionType,
} from "@/data/admin";
import { REPORT_TARGET_LABELS, type ReportTargetType } from "@/data/reports";
import { ACTION_LABELS, RESTRICTIVE_ACTIONS } from "./action-labels";

const PAGE_SIZE = 20;

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
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  // 숨김 상세는 웹에서 열리지 않으므로(작성자 포함 404), 신고 큐 밖에서 숨긴 콘텐츠의 복구 수단을 여기 둔다.
  const restorable = log.action === "CONTENT_HIDDEN" && !restored;

  const restore = async () => {
    if (busy) return;
    const ok = await confirm({
      title: "이 콘텐츠를 다시 공개할까요?",
      message: "공개 목록·검색에 다시 노출되고 작성자에게 알림이 갑니다. 이미 공개 상태면 변화가 없습니다.",
      confirmLabel: "복구",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await setAdminContentVisibility(log.targetType as ReportTargetType, log.targetId, { hidden: false });
      setRestored(true);
      toast.success("복구했습니다.");
    } catch (e) {
      toast.error(e instanceof ApiError ? apiErrorMessage(e, "복구에 실패했습니다.") : "복구에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

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
        {restorable && (
          <button
            type="button"
            onClick={restore}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Eye size={12} aria-hidden />}
            복구
          </button>
        )}
        {restored && (
          <span className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: "var(--accent-soft)", color: "var(--accent-secondary)" }}>
            복구됨
          </span>
        )}
      </div>
      <p className="mt-2 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
        대상: {targetLabel(log)} ·{" "}
        {log.targetType === "USER" ? (
          <Link href={`/users/${log.targetId}`} className="break-all hover:underline">
            {log.targetId}
          </Link>
        ) : (
          <span className="break-all">{log.targetId}</span>
        )}
      </p>
      {log.detail && <p className="mt-1 text-[13px]">{log.detail}</p>}
    </li>
  );
}

"use client";

import { toast } from "sonner";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Flag, Loader2, X } from "lucide-react";
import {
  createReport,
  REPORT_REASON_LABELS,
  type ReportReason,
  type ReportTargetType,
} from "@/data/reports";
import { clearSession, getSessionId } from "@/lib/auth";
import { ApiError, apiErrorMessage } from "@/lib/api";

const REASONS = Object.entries(REPORT_REASON_LABELS) as [ReportReason, string][];

export function ReportButton({
  targetType,
  targetId,
  ownedByMe,
  className = "",
}: {
  targetType: ReportTargetType;
  targetId: string;
  ownedByMe: boolean;
  className?: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (ownedByMe) return null;

  const loginToast = "로그인 후 신고할 수 있어요.";

  const goToLogin = () => {
    const next = `${window.location.pathname}${window.location.search}`;
    router.push(`/login?next=${encodeURIComponent(next)}`);
  };

  const open = () => {
    if (submitting) return;
    if (!getSessionId()) {
      toast.error(loginToast);
      goToLogin();
      return;
    }
    setError("");
    dialogRef.current?.showModal();
  };

  const close = () => {
    if (submitting) return;
    setError("");
    dialogRef.current?.close();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reason) {
      setError("신고 사유를 선택해주세요.");
      return;
    }
    const normalizedDetail = detail.trim();
    if (normalizedDetail.length > 500 || submitting) {
      setError("신고 내용을 500자 이하로 입력해주세요.");
      return;
    }
    const requestToken = getSessionId();
    if (!requestToken) {
      toast.error(loginToast);
      goToLogin();
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await createReport(
        {
          targetType,
          targetId,
          reason,
          detail: normalizedDetail || null,
        },
      );
      if (getSessionId() !== requestToken) return;
      setReason("");
      setDetail("");
      dialogRef.current?.close();
      toast.success("신고가 접수되었습니다.");
    } catch (caught) {
      if (getSessionId() !== requestToken) return;
      if (caught instanceof ApiError && caught.status === 401) {
        clearSession();
        dialogRef.current?.close();
        toast.error(loginToast);
        goToLogin();
      } else if (caught instanceof ApiError && caught.status === 409) {
        setError("이미 신고한 항목입니다.");
      } else if (caught instanceof ApiError && caught.status === 404) {
        setError("신고 대상을 찾을 수 없습니다.");
      } else if (caught instanceof ApiError && caught.status === 400) {
        setError(apiErrorMessage(caught, "신고 내용을 확인해주세요."));
      } else {
        setError("신고 접수에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="콘텐츠 신고"
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ed5c48]/60 ${className}`}
        style={{
          background: "rgba(var(--ink-rgb), 0.06)",
          color: "var(--danger)",
        }}
      >
        <Flag size={13} /> 신고
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`report-title-${targetType}-${targetId}`}
        onCancel={(event) => {
          if (submitting) event.preventDefault();
          else setError("");
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="m-auto w-[min(92vw,30rem)] rounded-3xl border p-0 shadow-2xl backdrop:bg-[rgba(var(--surface-dark-rgb),0.55)]"
        style={{
          background: "var(--panel)",
          borderColor: "rgba(var(--ink-rgb), 0.12)",
          color: "var(--foreground)",
        }}
      >
        <form onSubmit={submit} className="space-y-5 p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={`report-title-${targetType}-${targetId}`} className="text-lg font-semibold">
                콘텐츠 신고
              </h2>
              <p className="mt-1 text-[13px] opacity-65">신고만으로 콘텐츠가 자동 삭제되지는 않습니다.</p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              aria-label="신고 창 닫기"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[rgba(var(--ink-rgb),0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-40"
            >
              <X size={17} />
            </button>
          </div>

          <label className="block space-y-2 text-[13px]">
            <span>신고 사유</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as ReportReason | "")}
              disabled={submitting}
              className="ui-control bg-transparent px-3 py-2.5"
              required
            >
              <option value="">선택해주세요</option>
              {REASONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="block space-y-2 text-[13px]">
            <span>상세 내용 <span className="opacity-55">(선택)</span></span>
            <textarea
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              disabled={submitting}
              maxLength={500}
              rows={5}
              className="ui-control resize-none bg-transparent px-3 py-3"
              placeholder="신고 사유를 구체적으로 알려주세요."
            />
            <span className="block text-right text-[11px] opacity-55">{detail.length} / 500</span>
          </label>

          {error ? <p role="alert" className="rounded-xl bg-[rgba(var(--danger-rgb),0.1)] px-3 py-2 text-[13px] text-[var(--danger)]">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              className="rounded-full px-4 py-2.5 text-[13px] transition-colors hover:bg-[rgba(var(--ink-rgb),0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-40"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || !reason}
              aria-busy={submitting}
              aria-label={submitting ? "신고 접수 중" : "신고하기"}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--danger-solid)] px-5 py-2.5 text-[13px] text-white transition-colors hover:bg-[var(--danger-solid-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ed5c48]/60 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
              {submitting ? "접수 중…" : "신고하기"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

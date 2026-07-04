"use client";

import { type FormEvent, useRef, useState } from "react";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { deleteAccount } from "@/data/auth";
import { ApiError, apiErrorMessage } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme-context";
import { useConfirm } from "@/components/ui/confirm-dialog";

const CONFIRM_TEXT = "탈퇴합니다";

function deleteAccountError(error: ApiError): string {
  const detail = apiErrorMessage(error, "");
  if (detail.includes("current password is required")) return "현재 비밀번호를 입력해주세요.";
  if (detail.includes("current password is incorrect")) return "현재 비밀번호가 올바르지 않습니다.";
  if (detail.includes("delete confirmation is incorrect")) return "확인 문구를 정확히 입력해주세요.";
  return detail || "계정 탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.";
}

export function DeleteAccountForm({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const submittingRef = useRef(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const confirm = useConfirm();
  const canSubmit = currentPassword.trim().length > 0 && confirmText === CONFIRM_TEXT && !submitting;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!currentPassword.trim()) {
      setError("현재 비밀번호를 입력해주세요.");
      return;
    }
    if (confirmText !== CONFIRM_TEXT) {
      setError("확인 문구를 정확히 입력해주세요.");
      return;
    }
    if (!(await confirm({ message: "정말 계정을 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.", destructive: true, confirmLabel: "탈퇴" }))) return;

    const requestToken = getSessionId();
    if (!requestToken) {
      clearSession();
      router.replace("/login");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const response = await deleteAccount({ currentPassword, confirmText });
      if (getSessionId() !== requestToken) return;
      if (!response.deleted) {
        setError("계정 탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      clearSession();
      router.replace("/");
      router.refresh();
    } catch (requestError) {
      if (getSessionId() !== requestToken) return;
      if (requestError instanceof ApiError && requestError.status === 401) {
        clearSession();
        router.replace("/login");
      } else if (requestError instanceof ApiError) {
        setError(deleteAccountError(requestError));
      } else {
        setError("계정 탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const inputStyle = {
    background: dark ? "rgba(255,255,255,0.05)" : "#ffffff",
    borderColor: dark ? "rgba(248,113,113,0.28)" : "rgba(185,28,28,0.22)",
    color: dark ? "#f9f7f2" : "#0f1f22",
  };

  return (
    <section
      className={embedded ? undefined : "mx-auto mt-4 max-w-5xl px-6 sm:px-8"}
      aria-labelledby="delete-account-title"
    >
      <details
        className="rounded-3xl border border-red-500/25 bg-red-500/5 p-5 sm:p-7"
        onToggle={() => setError("")}
      >
        <summary className="flex cursor-pointer list-none items-center gap-3 text-red-500">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
            <TriangleAlert size={19} aria-hidden="true" />
          </span>
          <span>
            <strong id="delete-account-title" className="block text-[17px]">위험 영역</strong>
            <span className="text-[12px] opacity-75">계정 탈퇴</span>
          </span>
        </summary>

        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <p className="text-[13px] leading-6 text-red-500 sm:col-span-2">
            계정은 복구할 수 없습니다. 기존 콘텐츠는 탈퇴한 사용자 이름으로 유지됩니다.
            계정을 탈퇴하려면 아래에 &quot;{CONFIRM_TEXT}&quot;를 입력해주세요.
          </p>
          <label className="text-[12px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
            현재 비밀번호
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              disabled={submitting}
              className="ui-control mt-2 focus-visible:border-red-500 focus-visible:ring-red-500/20"
              style={inputStyle}
            />
          </label>
          <label className="text-[12px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
            확인 문구
            <input
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
              disabled={submitting}
              placeholder={CONFIRM_TEXT}
              className="ui-control mt-2 focus-visible:border-red-500 focus-visible:ring-red-500/20"
              style={inputStyle}
            />
          </label>

          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <div aria-live="polite">
              {error ? <p role="alert" className="text-[12px] text-red-500">{error}</p> : null}
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
              {submitting ? "탈퇴 처리 중…" : "계정 탈퇴"}
            </button>
          </div>
        </form>
      </details>
    </section>
  );
}

"use client";

import { type FormEvent, useRef, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  changePassword,
  getPasswordPolicyState,
  PASSWORD_POLICY_MESSAGE,
} from "@/data/auth";
import { ApiError, apiErrorMessage } from "@/lib/api";
import { clearSession, getSessionId, setSession } from "@/lib/auth";
import { useRouter } from "next/navigation";

function changePasswordError(error: ApiError): string {
  const detail = apiErrorMessage(error, "");
  if (detail.includes("current password is incorrect")) return "현재 비밀번호가 올바르지 않습니다.";
  if (detail.includes("new password must be different")) return "기존 비밀번호와 다른 새 비밀번호를 입력해주세요.";
  if (detail.includes("password must be")) return PASSWORD_POLICY_MESSAGE;
  return detail || "비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요.";
}

export function ChangePasswordForm({ profileName, embedded = false }: { profileName: string; embedded?: boolean }) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!currentPassword) {
      setError("현재 비밀번호를 입력해주세요.");
      return;
    }
    if (!newPassword) {
      setError("새 비밀번호를 입력해주세요.");
      return;
    }
    if (!confirmPassword || newPassword !== confirmPassword) {
      setError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("기존 비밀번호와 다른 새 비밀번호를 입력해주세요.");
      return;
    }
    if (!getPasswordPolicyState(newPassword).valid) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }

    const requestToken = getSessionId();
    if (!requestToken) {
      clearSession();
      router.push("/login");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const response = await changePassword({ currentPassword, newPassword });
      if (getSessionId() !== requestToken) return;
      if (!response.changed) {
        setError("비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      if (response.token) setSession(profileName);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      // setSession 이 세션 마커를 재발급하면 프로필 리페치로 이 폼이 리마운트되므로
      // 인라인 메시지 대신 리마운트에도 남는 toast 로 성공을 알린다.
      toast.success("비밀번호가 변경되었습니다.");
    } catch (requestError) {
      if (getSessionId() !== requestToken) return;
      if (requestError instanceof ApiError && requestError.status === 401) {
        clearSession();
        router.push("/login");
      } else if (requestError instanceof ApiError) {
        setError(changePasswordError(requestError));
      } else {
        setError("비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const inputStyle = {
    background: "var(--card)",
    borderColor: "var(--border)",
    color: "var(--foreground)",
  };

  return (
    <section
      className={embedded ? undefined : "mx-auto mb-10 max-w-5xl px-6 sm:px-8"}
      aria-labelledby="change-password-title"
    >
      <div
        className="rounded-3xl border p-5 sm:p-7"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7dd3a3]/15 text-[#7dd3a3]">
            <KeyRound size={19} />
          </div>
          <div>
            <h2 id="change-password-title" className="text-[17px] font-semibold" style={{ color: "var(--foreground)" }}>
              비밀번호 변경
            </h2>
            <p className="mt-0.5 text-[12px] opacity-60" style={{ color: "var(--foreground)" }}>
              {PASSWORD_POLICY_MESSAGE}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
          <label className="text-[12px]" style={{ color: "var(--foreground)" }}>
            현재 비밀번호
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              disabled={submitting}
              className="ui-control mt-2"
              style={inputStyle}
            />
          </label>
          <label className="text-[12px]" style={{ color: "var(--foreground)" }}>
            새 비밀번호
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={15}
              disabled={submitting}
              className="ui-control mt-2"
              style={inputStyle}
            />
          </label>
          <label className="text-[12px]" style={{ color: "var(--foreground)" }}>
            새 비밀번호 확인
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={15}
              disabled={submitting}
              className="ui-control mt-2"
              style={inputStyle}
            />
          </label>

          <div className="flex flex-col gap-3 lg:col-span-3 sm:flex-row sm:items-center sm:justify-between">
            <div aria-live="polite">
              {error ? <p role="alert" className="text-[12px] text-[#ed5c48]">{error}</p> : null}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7dd3a3] px-6 py-3 text-[13px] font-medium text-[#0f1f22] disabled:cursor-wait disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {submitting ? "변경 중…" : "비밀번호 변경"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

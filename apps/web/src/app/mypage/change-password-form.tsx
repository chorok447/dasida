"use client";

import { type FormEvent, useRef, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import {
  changePassword,
  getPasswordPolicyState,
  PASSWORD_POLICY_MESSAGE,
} from "@/data/auth";
import { ApiError, apiErrorMessage } from "@/lib/api";
import { clearSession, getToken, setSession } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme-context";

function changePasswordError(error: ApiError): string {
  const detail = apiErrorMessage(error, "");
  if (detail.includes("current password is incorrect")) return "현재 비밀번호가 올바르지 않습니다.";
  if (detail.includes("new password must be different")) return "기존 비밀번호와 다른 새 비밀번호를 입력해주세요.";
  if (detail.includes("password must be")) return PASSWORD_POLICY_MESSAGE;
  return detail || "비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요.";
}

export function ChangePasswordForm({ profileName }: { profileName: string }) {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const submittingRef = useRef(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

    const requestToken = getToken();
    if (!requestToken) {
      clearSession();
      router.push("/login");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await changePassword({ currentPassword, newPassword }, requestToken);
      if (getToken() !== requestToken) return;
      if (!response.changed) {
        setError("비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      if (response.token) setSession(response.token, profileName);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("비밀번호가 변경되었습니다.");
    } catch (requestError) {
      if (getToken() !== requestToken) return;
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
    background: dark ? "rgba(255,255,255,0.05)" : "#ffffff",
    borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(28,64,68,0.12)",
    color: dark ? "#f9f7f2" : "#0f1f22",
  };

  return (
    <section
      className="mx-auto mb-10 max-w-5xl px-6 sm:px-8"
      aria-labelledby="change-password-title"
    >
      <div
        className="rounded-3xl border p-5 sm:p-7"
        style={{
          background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
          borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
        }}
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7dd3a3]/15 text-[#7dd3a3]">
            <KeyRound size={19} />
          </div>
          <div>
            <h2 id="change-password-title" className="text-[17px] font-semibold" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              비밀번호 변경
            </h2>
            <p className="mt-0.5 text-[12px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              {PASSWORD_POLICY_MESSAGE}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
          <label className="text-[12px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
            현재 비밀번호
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              disabled={submitting}
              className="mt-2 w-full rounded-xl border px-4 py-3 text-[14px] outline-none focus:border-[#7dd3a3] disabled:opacity-50"
              style={inputStyle}
            />
          </label>
          <label className="text-[12px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
            새 비밀번호
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={15}
              disabled={submitting}
              className="mt-2 w-full rounded-xl border px-4 py-3 text-[14px] outline-none focus:border-[#7dd3a3] disabled:opacity-50"
              style={inputStyle}
            />
          </label>
          <label className="text-[12px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
            새 비밀번호 확인
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={15}
              disabled={submitting}
              className="mt-2 w-full rounded-xl border px-4 py-3 text-[14px] outline-none focus:border-[#7dd3a3] disabled:opacity-50"
              style={inputStyle}
            />
          </label>

          <div className="flex flex-col gap-3 lg:col-span-3 sm:flex-row sm:items-center sm:justify-between">
            <div aria-live="polite">
              {error ? <p role="alert" className="text-[12px] text-[#ed5c48]">{error}</p> : null}
              {success ? <p className="text-[12px] text-[#7dd3a3]">{success}</p> : null}
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

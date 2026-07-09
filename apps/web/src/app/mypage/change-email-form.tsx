"use client";

import { type FormEvent, useRef, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { changeEmail, isValidEmail, normalizeEmail } from "@/data/auth";
import { ApiError, apiErrorMessage } from "@/lib/api";
import { clearSession, getSessionId, setSession } from "@/lib/auth";
import { useRouter } from "next/navigation";

function changeEmailError(error: ApiError): string {
  if (error.status === 409) return "이미 사용 중인 이메일입니다.";
  const detail = apiErrorMessage(error, "");
  if (detail.includes("current password is required")) return "현재 비밀번호를 입력해주세요.";
  if (detail.includes("current password is incorrect")) return "현재 비밀번호가 올바르지 않습니다.";
  if (detail.includes("email is required")) return "새 이메일을 입력해주세요.";
  if (detail.includes("invalid email format")) return "이메일 형식이 올바르지 않습니다.";
  if (detail.includes("new email must be different")) return "현재 이메일과 다른 이메일을 입력해주세요.";
  return detail || "이메일 변경에 실패했습니다. 잠시 후 다시 시도해주세요.";
}

export function ChangeEmailForm({
  currentEmail,
  onChanged,
  embedded = false,
}: {
  currentEmail: string;
  onChanged: (email: string) => void;
  embedded?: boolean;
}) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const normalizedEmail = normalizeEmail(newEmail);
    if (!normalizedEmail) {
      setError("새 이메일을 입력해주세요.");
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setError("이메일 형식이 올바르지 않습니다.");
      return;
    }
    if (normalizedEmail === normalizeEmail(currentEmail)) {
      setError("현재 이메일과 다른 이메일을 입력해주세요.");
      return;
    }
    if (!currentPassword.trim()) {
      setError("현재 비밀번호를 입력해주세요.");
      return;
    }

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
      const response = await changeEmail(
        { currentPassword, newEmail: normalizedEmail },
      );
      if (getSessionId() !== requestToken) return;
      setSession(response.name);
      onChanged(response.email);
      setNewEmail("");
      setCurrentPassword("");
      // setSession 이 세션 마커를 재발급하면 프로필 리페치로 이 폼이 리마운트되므로
      // 인라인 메시지 대신 리마운트에도 남는 toast 로 성공을 알린다.
      toast.success("이메일이 변경되었습니다.");
    } catch (requestError) {
      if (getSessionId() !== requestToken) return;
      if (requestError instanceof ApiError && requestError.status === 401) {
        clearSession();
        router.replace("/login");
      } else if (requestError instanceof ApiError) {
        setError(changeEmailError(requestError));
      } else {
        setError("이메일 변경에 실패했습니다. 잠시 후 다시 시도해주세요.");
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
      className={embedded ? undefined : "mx-auto mb-6 max-w-5xl px-6 sm:px-8"}
      aria-labelledby="change-email-title"
    >
      <div
        className="rounded-3xl border p-5 sm:p-7"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7dd3a3]/15 text-[#7dd3a3]">
            <Mail size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id="change-email-title" className="text-[17px] font-semibold" style={{ color: "var(--foreground)" }}>
              이메일 변경
            </h2>
            <p className="mt-0.5 text-[12px] opacity-60" style={{ color: "var(--foreground)" }}>
              현재 비밀번호 확인 후 로그인 이메일을 변경합니다.
            </p>
          </div>
        </div>

        <form onSubmit={submit} noValidate className="grid gap-4 lg:grid-cols-3">
          <label className="text-[12px]" style={{ color: "var(--foreground)" }}>
            현재 이메일
            <input
              type="email"
              value={currentEmail}
              readOnly
              autoComplete="email"
              className="ui-control mt-2 opacity-65"
              style={inputStyle}
            />
          </label>
          <label className="text-[12px]" style={{ color: "var(--foreground)" }}>
            새 이메일
            <input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              autoComplete="email"
              disabled={submitting}
              className="ui-control mt-2"
              style={inputStyle}
            />
          </label>
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

          <div className="flex flex-col gap-3 lg:col-span-3 sm:flex-row sm:items-center sm:justify-between">
            <div aria-live="polite">
              {error ? <p role="alert" className="text-[12px]" style={{ color: "var(--danger)" }}>{error}</p> : null}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7dd3a3] px-6 py-3 text-[13px] font-medium text-[#0f1f22] disabled:cursor-wait disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
              {submitting ? "변경 중…" : "이메일 변경"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

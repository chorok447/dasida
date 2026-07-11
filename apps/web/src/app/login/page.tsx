"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { AuthShell, FieldInput } from "@/components/auth-shell";
import { apiPost, ApiError, apiErrorMessage } from "@/lib/api";
import { setSession } from "@/lib/auth";
import { safeInternalPath } from "@/lib/safe-path";

type AuthResponse = { token: string; name: string; verified: boolean };

const REMEMBER_EMAIL_KEY = "dasida_remember_email";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signupHref, setSignupHref] = useState("/signup");

  useEffect(() => {
    // 하이드레이션 이후 비동기로 1회 복원 — SSR HTML 과의 mismatch 와 effect 내 동기 setState 를 피한다.
    const restore = () => {
      // 보호 페이지에서 넘어온 next 를 회원가입으로도 전파해 가입 직후 원래 목적지로 복귀시킨다.
      const next = safeInternalPath(new URLSearchParams(window.location.search).get("next"));
      if (next) setSignupHref(`/signup?next=${encodeURIComponent(next)}`);
      try {
        const saved = window.localStorage.getItem(REMEMBER_EMAIL_KEY);
        if (saved) {
          setEmail(saved);
          setRememberEmail(true);
        }
      } catch {
        // localStorage 접근 불가(사생활 보호 모드 등)면 프리필 없이 진행.
      }
    };
    const timer = window.setTimeout(restore, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const submit = async () => {
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await apiPost<AuthResponse>("/api/auth/login", { email, password });
      setSession(res.name);
      try {
        if (rememberEmail) window.localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
        else window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      } catch {
        // 저장 실패는 로그인 흐름에 영향 없음.
      }
      // 보호 페이지에서 넘어온 경우 복귀(open redirect 방지: 내부 경로만 허용).
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(safeInternalPath(next) ?? "/feed");
    } catch (e) {
      setSubmitting(false);
      // 보안상 이메일 존재 여부는 드러내지 않음(401은 자격증명 오류로 통일).
      // 403은 정지 계정 — 서버가 내려준 안내(기간 포함)를 그대로 보여준다. 그 외는 일시적 오류 안내.
      setError(
        e instanceof ApiError && e.status === 401
          ? "이메일 또는 비밀번호가 올바르지 않습니다."
          : e instanceof ApiError && e.status === 403
            ? apiErrorMessage(e, "이용이 정지된 계정입니다.")
            : "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
    }
  };

  return (
    <AuthShell
      subtitle="Welcome back"
      title="로그인"
      footer={
        <p className="text-center text-[14px] mt-6" style={{ color: "rgba(var(--ink-rgb), 0.7)" }}>
          아직 회원이 아니신가요?{" "}
          <Link href={signupHref} className="underline" style={{ color: "var(--accent)" }}>
            회원가입
          </Link>
        </p>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FieldInput label="이메일" name="email" autoComplete="email" icon={<Mail size={18} />} placeholder="이메일을 입력하세요" value={email} onChange={setEmail} />
        <FieldInput
          label="비밀번호"
          name="password"
          autoComplete="current-password"
          icon={<Lock size={18} />}
          type="password"
          placeholder="비밀번호를 입력하세요"
          value={password}
          onChange={setPassword}
          error={error}
        />

        <div className="flex items-center justify-between text-[13px]" style={{ color: "rgba(var(--ink-rgb), 0.7)" }}>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={rememberEmail}
              onChange={(event) => setRememberEmail(event.target.checked)}
            />
            이메일 기억하기
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting || !email.trim() || !password}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-medium transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:opacity-40 motion-reduce:transform-none"
          style={{ background: "var(--accent)", color: "#0f1f22" }}
        >
          {submitting ? "로그인 중…" : "로그인"} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </form>
    </AuthShell>
  );
}

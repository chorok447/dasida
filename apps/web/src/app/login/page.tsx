"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { AuthShell, FieldInput } from "@/components/auth-shell";
import { apiPost, ApiError, apiErrorMessage } from "@/lib/api";
import { setSession } from "@/lib/auth";

type AuthResponse = { token: string; name: string; verified: boolean };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await apiPost<AuthResponse>("/api/auth/login", { email, password });
      setSession(res.name);
      // 보호 페이지에서 넘어온 경우 복귀(open redirect 방지: 내부 경로만 허용).
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") ? next : "/feed");
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
          <Link href="/signup" className="underline" style={{ color: "#7dd3a3" }}>
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
            <input type="checkbox" className="h-4 w-4 accent-[#7dd3a3]" />
            이메일 기억하기
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting || !email.trim() || !password}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-medium transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:opacity-40 motion-reduce:transform-none"
          style={{ background: "#7dd3a3", color: "#0f1f22" }}
        >
          {submitting ? "로그인 중…" : "로그인"} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </form>
    </AuthShell>
  );
}

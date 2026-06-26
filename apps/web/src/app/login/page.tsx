"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { AuthShell, FieldInput } from "@/components/auth-shell";
import { useTheme } from "@/lib/theme-context";
import { apiPost, ApiError } from "@/lib/api";
import { setSession } from "@/lib/auth";

type AuthResponse = { token: string; name: string; verified: boolean };

export default function LoginPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
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
      setSession(res.token, res.name);
      router.push("/feed");
    } catch (e) {
      setSubmitting(false);
      // 보안상 이메일 존재 여부는 드러내지 않음(401은 자격증명 오류로 통일). 그 외는 일시적 오류 안내.
      setError(
        e instanceof ApiError && e.status === 401
          ? "이메일 또는 비밀번호가 올바르지 않습니다."
          : "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
    }
  };

  return (
    <AuthShell
      subtitle="Welcome back"
      title="로그인"
      footer={
        <p className="text-center text-[14px] mt-6" style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}>
          아직 회원이 아니신가요?{" "}
          <Link href="/signup" className="underline" style={{ color: "#7dd3a3" }}>
            회원가입
          </Link>
        </p>
      }
    >
      <FieldInput icon={<Mail size={18} />} placeholder="이메일을 입력하세요" value={email} onChange={setEmail} />
      <FieldInput
        icon={<Lock size={18} />}
        type="password"
        placeholder="비밀번호를 입력하세요"
        value={password}
        onChange={setPassword}
        error={error}
      />

      <div className="flex items-center justify-between text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-[#7dd3a3]" />
          이메일 기억하기
        </label>
        <a href="#" style={{ color: "#7dd3a3" }}>비밀번호 찾기</a>
      </div>

      <button
        onClick={submit}
        disabled={submitting || !email.trim() || !password}
        className="w-full mt-2 py-3.5 rounded-xl flex items-center justify-center gap-2 font-medium transition-transform hover:-translate-y-0.5 disabled:opacity-40"
        style={{ background: "#7dd3a3", color: "#0f1f22" }}
      >
        {submitting ? "로그인 중…" : "로그인"} <ArrowRight size={16} />
      </button>
    </AuthShell>
  );
}

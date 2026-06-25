"use client";

import Link from "next/link";
import { Mail, Lock, User, IdCard, Check, ArrowRight } from "lucide-react";
import { AuthShell, FieldInput } from "@/components/auth-shell";
import { useTheme } from "@/lib/theme-context";

function Rule({ ok, label }: { ok: boolean; label: string }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div className="flex items-center gap-1.5 text-[12px]" style={{ color: ok ? "#7dd3a3" : dark ? "rgba(255,255,255,0.4)" : "rgba(28,64,68,0.4)" }}>
      <Check size={14} />
      {label}
    </div>
  );
}

export default function SignupPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <AuthShell
      subtitle="Join the journey"
      title="회원가입"
      footer={
        <p className="text-center text-[14px] mt-4" style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}>
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="underline" style={{ color: "#7dd3a3" }}>
            로그인
          </Link>
        </p>
      }
    >
      <FieldInput icon={<Mail size={18} />} placeholder="이메일을 입력하세요" error="사용 중인 이메일입니다." />
      <FieldInput icon={<Lock size={18} />} type="password" placeholder="비밀번호를 입력하세요" />
      <div className="flex gap-3 px-1">
        <Rule ok label="영문" />
        <Rule ok={false} label="숫자" />
        <Rule ok={false} label="특수문자" />
        <Rule ok={false} label="8~15자리" />
      </div>
      <FieldInput icon={<Lock size={18} />} type="password" placeholder="비밀번호를 다시 입력하세요" />
      <FieldInput icon={<IdCard size={18} />} placeholder="이름을 입력하세요" />
      <FieldInput icon={<User size={18} />} placeholder="닉네임을 입력하세요" />

      <button
        className="w-full mt-2 py-3.5 rounded-xl flex items-center justify-center gap-2 font-medium transition-transform hover:-translate-y-0.5"
        style={{ background: "#7dd3a3", color: "#0f1f22" }}
      >
        회원가입 <ArrowRight size={16} />
      </button>
    </AuthShell>
  );
}

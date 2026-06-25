"use client";

import Link from "next/link";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { AuthShell, FieldInput } from "@/components/auth-shell";
import { useTheme } from "@/lib/theme-context";

export default function LoginPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
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
      <FieldInput icon={<Mail size={18} />} placeholder="이메일을 입력하세요" />
      <FieldInput icon={<Lock size={18} />} type="password" placeholder="비밀번호를 입력하세요" />

      <div className="flex items-center justify-between text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-[#7dd3a3]" />
          이메일 기억하기
        </label>
        <a href="#" style={{ color: "#7dd3a3" }}>비밀번호 찾기</a>
      </div>

      <button
        className="w-full mt-2 py-3.5 rounded-xl flex items-center justify-center gap-2 font-medium transition-transform hover:-translate-y-0.5"
        style={{ background: "#7dd3a3", color: "#0f1f22" }}
      >
        로그인 <ArrowRight size={16} />
      </button>
    </AuthShell>
  );
}

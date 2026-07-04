"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, IdCard, Check, ArrowRight } from "lucide-react";
import { AuthShell, FieldInput } from "@/components/auth-shell";
import { useTheme } from "@/lib/theme-context";
import { apiPost, ApiError } from "@/lib/api";
import { setSession } from "@/lib/auth";
import { getPasswordPolicyState, isValidEmail } from "@/data/auth";

type AuthResponse = { token: string; name: string; verified: boolean };

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
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [realName, setRealName] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const passwordPolicy = getPasswordPolicyState(password);
  const canSubmit = isValidEmail(email) && passwordPolicy.valid && password === passwordConfirm && nickname.trim();

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await apiPost<AuthResponse>("/api/auth/signup", { email, password, name: nickname });
      setSession(res.name);
      router.push("/feed");
    } catch (e) {
      setSubmitting(false);
      setError(e instanceof ApiError && e.status === 409 ? "이미 사용 중인 이메일입니다." : "회원가입에 실패했습니다.");
    }
  };

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
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FieldInput label="이메일" name="email" autoComplete="email" icon={<Mail size={18} />} placeholder="이메일을 입력하세요" value={email} onChange={setEmail} error={error} />
        <FieldInput label="비밀번호" name="password" autoComplete="new-password" icon={<Lock size={18} />} type="password" placeholder="비밀번호를 입력하세요" value={password} onChange={setPassword} />
        <div className="flex flex-wrap gap-3 px-1">
          <Rule ok={passwordPolicy.hasLetter} label="영문" />
          <Rule ok={passwordPolicy.hasNumber} label="숫자" />
          <Rule ok={passwordPolicy.hasSpecial} label="특수문자" />
          <Rule ok={passwordPolicy.lengthValid} label="8~15자리" />
        </div>
        <FieldInput
          label="비밀번호 확인"
          name="password-confirm"
          autoComplete="new-password"
          icon={<Lock size={18} />}
          type="password"
          placeholder="비밀번호를 다시 입력하세요"
          value={passwordConfirm}
          onChange={setPasswordConfirm}
          error={passwordConfirm && password !== passwordConfirm ? "비밀번호가 일치하지 않습니다." : undefined}
        />
        <FieldInput label="이름" name="real-name" autoComplete="name" icon={<IdCard size={18} />} placeholder="이름을 입력하세요" value={realName} onChange={setRealName} />
        <FieldInput label="닉네임" name="nickname" icon={<User size={18} />} placeholder="닉네임을 입력하세요" value={nickname} onChange={setNickname} />

        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-medium transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:opacity-40 motion-reduce:transform-none"
          style={{ background: "#7dd3a3", color: "#0f1f22" }}
        >
          {submitting ? "가입 중…" : "회원가입"} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </form>
    </AuthShell>
  );
}

"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogIn, RefreshCw, UserRound } from "lucide-react";
import { apiPut, ApiError } from "@/lib/api";
import { clearSession, getToken, setSession } from "@/lib/auth";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import { useTheme } from "@/lib/theme-context";
import type { UpdateProfileResponse, UserProfile } from "@/data/users";

const MAX_NAME_LENGTH = 30;

function PageState({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div
      className="mx-auto flex min-h-72 max-w-2xl flex-col items-center justify-center gap-4 rounded-3xl border px-6 text-center"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.75)",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
        color: dark ? "#f9f7f2" : "#0f1f22",
      }}
    >
      {children}
    </div>
  );
}

function ProfileEditForm({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [name, setName] = useState(profile.name);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("표시 이름을 입력해주세요.");
      return;
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      setError(`표시 이름은 ${MAX_NAME_LENGTH}자 이하여야 합니다.`);
      return;
    }

    const requestToken = getToken();
    if (!requestToken) {
      clearSession();
      router.push("/login");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await apiPut<UpdateProfileResponse>("/api/auth/me", { name: trimmedName });
      if (getToken() !== requestToken) return;
      setSession(response.token, response.profile.name);
      router.push("/mypage");
    } catch (requestError) {
      if (getToken() !== requestToken) return;
      if (requestError instanceof ApiError && requestError.status === 401) {
        clearSession();
        router.push("/login");
      } else {
        setError("프로필을 수정하지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/mypage"
        className="mb-6 inline-flex items-center gap-2 text-[13px] opacity-70 transition-opacity hover:opacity-100"
        style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
      >
        <ArrowLeft size={14} /> 마이페이지로 돌아가기
      </Link>

      <div
        className="rounded-3xl border p-6 shadow-[0_35px_75px_-30px_rgba(0,0,0,0.45)] sm:p-10"
        style={{
          background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.78)",
          borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.08)",
        }}
      >
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
            style={{
              background: dark ? "rgba(125,211,163,0.14)" : "rgba(125,211,163,0.3)",
              color: dark ? "#7dd3a3" : "#1c4044",
            }}
          >
            <UserRound size={34} />
          </div>
          <div>
            <h1
              style={{
                fontFamily: "'Black Han Sans', sans-serif",
                fontSize: "clamp(30px, 6vw, 42px)",
                color: dark ? "#f9f7f2" : "#0f1f22",
              }}
            >
              프로필 수정
            </h1>
            <p
              className="mt-1 text-[13px]"
              style={{ color: dark ? "rgba(255,255,255,0.55)" : "rgba(28,64,68,0.55)" }}
            >
              프로필 이미지 변경은 준비 중입니다.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-6">
          <div>
            <label htmlFor="profile-name" className="mb-2 block text-[13px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              표시 이름
            </label>
            <input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="name"
              disabled={submitting}
              className="w-full rounded-xl border px-4 py-3 outline-none transition-colors focus:border-[#7dd3a3] disabled:opacity-60"
              style={{
                background: dark ? "rgba(255,255,255,0.06)" : "#ffffff",
                borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(28,64,68,0.12)",
                color: dark ? "#f9f7f2" : "#0f1f22",
              }}
            />
            <p className="mt-1 text-right text-[11px] opacity-50" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              {name.length}/{MAX_NAME_LENGTH}
            </p>
          </div>

          <div>
            <label htmlFor="profile-email" className="mb-2 block text-[13px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              이메일
            </label>
            <input
              id="profile-email"
              value={profile.email}
              readOnly
              aria-readonly="true"
              className="w-full rounded-xl border px-4 py-3 opacity-65 outline-none"
              style={{
                background: dark ? "rgba(255,255,255,0.03)" : "rgba(28,64,68,0.04)",
                borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
                color: dark ? "#f9f7f2" : "#0f1f22",
              }}
            />
          </div>

          {error ? (
            <p role="alert" aria-live="polite" className="rounded-xl bg-[#ed5c48]/10 px-4 py-3 text-[13px] text-[#ed5c48]">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Link
              href="/mypage"
              className="rounded-xl px-6 py-3 text-center text-[13px]"
              style={{
                background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)",
                color: dark ? "#f9f7f2" : "#0f1f22",
              }}
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#7dd3a3] px-8 py-3 text-[13px] font-medium text-[#0f1f22] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-50"
            >
              {submitting ? "저장 중…" : "저장하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProfileEditPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const { profile, loading, error, isLoggedIn, retry } = useCurrentUserProfile();

  return (
    <section
      className="relative min-h-screen overflow-hidden px-6 pb-20 pt-28 transition-colors sm:pt-32"
      style={{
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute right-1/4 top-32 h-[500px] w-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <div className="relative">
        {!isLoggedIn ? (
          <PageState>
            <LogIn size={30} className="text-[#7dd3a3]" />
            <p>프로필을 수정하려면 로그인이 필요합니다.</p>
            <Link href="/login" className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
              로그인 페이지로 이동
            </Link>
          </PageState>
        ) : loading ? (
          <PageState>
            <RefreshCw size={28} className="animate-spin text-[#7dd3a3]" />
            <p>사용자 정보를 불러오는 중입니다.</p>
          </PageState>
        ) : error || !profile ? (
          <PageState>
            <p>{error || "사용자 정보를 불러오지 못했습니다."}</p>
            <button type="button" onClick={retry} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
              다시 시도
            </button>
          </PageState>
        ) : (
          <ProfileEditForm key={`${profile.id}:${profile.name}`} profile={profile} />
        )}
      </div>
    </section>
  );
}

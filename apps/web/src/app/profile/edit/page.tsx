"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, LogIn, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiErrorMessage } from "@/lib/api";
import { clearSession, getSessionId, notifyProfileUpdated, setSession } from "@/lib/auth";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import { useTheme } from "@/lib/theme-context";
import {
  MAX_NAME_LENGTH,
  MAX_PROFILE_IMAGE_URL_LENGTH,
  updateProfile,
  validateProfileUpdate,
  type UserProfile,
} from "@/data/users";
import { Avatar } from "@/components/avatar";
import { FallbackImage } from "@/components/fallback-image";
import { StatePanel } from "@/components/ui/state-panel";

function profileUpdateError(error: ApiError): string {
  const detail = apiErrorMessage(error, "");
  if (detail.includes("name is required") || detail.includes("name is too long")) {
    return `표시 이름은 ${MAX_NAME_LENGTH}자 이하여야 합니다.`;
  }
  if (detail.includes("profile image url must be http(s)")) {
    return "프로필 이미지 URL은 http:// 또는 https:// 로 시작해야 합니다.";
  }
  if (detail.includes("profile image url is too long")) {
    return `프로필 이미지 URL은 ${MAX_PROFILE_IMAGE_URL_LENGTH}자 이하여야 합니다.`;
  }
  return detail || "프로필을 수정하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

function ProfileImagePreview({
  name,
  url,
  dark,
  onClear,
  disabled,
}: {
  name: string;
  url: string;
  dark: boolean;
  onClear: () => void;
  disabled: boolean;
}) {
  const trimmed = url.trim();
  if (!trimmed) {
    return (
      <div className="relative">
        <Avatar name={name} size={96} />
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className="h-24 w-24 overflow-hidden rounded-full shadow-[0_12px_30px_-12px_rgba(0,0,0,0.45)]"
        style={{ border: `2px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(28,64,68,0.12)"}` }}
      >
        <FallbackImage
          src={trimmed}
          alt={`${name} 프로필 이미지 미리보기`}
          className="h-full w-full object-cover"
          errorText="이미지를 불러올 수 없어요"
          dark={dark}
        />
      </div>
      <button
        type="button"
        onClick={onClear}
        disabled={disabled}
        className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#ed5c48] text-white shadow-md transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="프로필 이미지 URL 삭제"
      >
        <Trash2 size={14} aria-hidden />
      </button>
    </div>
  );
}

function ProfileEditForm({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [name, setName] = useState(profile.name);
  const [profileImageUrl, setProfileImageUrl] = useState(profile.profileImageUrl ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const validation = validateProfileUpdate({ name, profileImageUrl });
    if (!validation.ok) {
      setError(validation.message);
      toast.error(validation.message);
      return;
    }

    const requestToken = getSessionId();
    if (!requestToken) {
      clearSession();
      toast.error("로그인이 필요합니다.");
      router.push("/login");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await updateProfile(
        { name: validation.name, profileImageUrl: validation.profileImageUrl },
      );
      if (getSessionId() !== requestToken) return;
      setSession(response.profile.name);
      notifyProfileUpdated();
      toast.success("프로필이 저장되었습니다.");
      router.push("/mypage");
    } catch (requestError) {
      if (getSessionId() !== requestToken) return;
      if (requestError instanceof ApiError && requestError.status === 401) {
        clearSession();
        toast.error("로그인이 필요합니다.");
        router.push("/login");
      } else if (requestError instanceof ApiError) {
        const message = profileUpdateError(requestError);
        setError(message);
        toast.error(message);
      } else {
        const message = "프로필을 수정하지 못했습니다. 잠시 후 다시 시도해주세요.";
        setError(message);
        toast.error(message);
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
          <ProfileImagePreview
            name={name.trim() || profile.name}
            url={profileImageUrl}
            dark={dark}
            disabled={submitting}
            onClear={() => setProfileImageUrl("")}
          />
          <div>
            <h1
              style={{
                fontFamily: "'Black Han Sans', sans-serif",
                fontSize: "clamp(30px, 6vw, 42px)",
                color: dark ? "#f9f7f2" : "#0f1f22",
              }}
            >
              프로필 편집
            </h1>
            <p
              className="mt-1 text-[13px]"
              style={{ color: dark ? "rgba(255,255,255,0.55)" : "rgba(28,64,68,0.55)" }}
            >
              표시 이름과 프로필 이미지 URL을 변경할 수 있습니다.
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
              className="ui-control"
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
            <label htmlFor="profile-image-url" className="mb-2 block text-[13px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              프로필 이미지 URL
            </label>
            <input
              id="profile-image-url"
              value={profileImageUrl}
              onChange={(event) => setProfileImageUrl(event.target.value)}
              maxLength={MAX_PROFILE_IMAGE_URL_LENGTH}
              placeholder="https://example.com/avatar.png"
              disabled={submitting}
              className="ui-control"
              style={{
                background: dark ? "rgba(255,255,255,0.06)" : "#ffffff",
                borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(28,64,68,0.12)",
                color: dark ? "#f9f7f2" : "#0f1f22",
              }}
            />
            <p className="mt-1 text-[11px] opacity-50" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              http 또는 https URL만 사용할 수 있습니다. 비워두면 기본 아바타가 표시됩니다.
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
              className="ui-control opacity-65"
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
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7dd3a3] px-8 py-3 text-[13px] font-medium text-[#0f1f22] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  저장 중…
                </>
              ) : (
                "저장하기"
              )}
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
        {/* loading을 먼저 확인: hydration 전(로그인 미확정)에 비로그인 패널이 깜빡이지 않도록. */}
        {loading ? (
          <StatePanel className="mx-auto min-h-72 max-w-2xl">
            <RefreshCw size={28} className="animate-spin text-[#7dd3a3]" />
            <p>사용자 정보를 불러오는 중입니다.</p>
          </StatePanel>
        ) : !isLoggedIn ? (
          <StatePanel className="mx-auto min-h-72 max-w-2xl">
            <LogIn size={30} className="text-[#7dd3a3]" />
            <p>프로필을 수정하려면 로그인이 필요합니다.</p>
            <Link href="/login" className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
              로그인 페이지로 이동
            </Link>
          </StatePanel>
        ) : error || !profile ? (
          <StatePanel className="mx-auto min-h-72 max-w-2xl" role="alert">
            <p>{error || "사용자 정보를 불러오지 못했습니다."}</p>
            <button type="button" onClick={retry} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
              다시 시도
            </button>
          </StatePanel>
        ) : (
          <ProfileEditForm key={`${profile.id}:${profile.name}:${profile.profileImageUrl ?? ""}`} profile={profile} />
        )}
      </div>
    </section>
  );
}

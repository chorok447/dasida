"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, LogIn, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiErrorMessage } from "@/lib/api";
import { clearSession, getSessionId, notifyProfileUpdated, setSession } from "@/lib/auth";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import {
  MAX_NAME_LENGTH,
  MAX_PROFILE_IMAGE_URL_LENGTH,
  isValidProfileImageUrl,
  updateProfile,
  validateProfileUpdate,
  type UserProfile,
} from "@/data/users";
import { Avatar } from "@/components/avatar";
import { ImageFileUploadButton } from "@/components/image-file-upload-button";
import { FallbackImage } from "@/components/fallback-image";
import { StatePanel } from "@/components/ui/state-panel";
import { PageShell } from "@/components/page-shell";

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
  onClear,
  disabled,
}: {
  name: string;
  url: string;
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
        style={{ border: "2px solid var(--border)" }}
      >
        <FallbackImage
          src={trimmed}
          alt={`${name} 프로필 이미지 미리보기`}
          className="h-full w-full object-cover"
          errorText="이미지를 불러올 수 없어요"
        />
      </div>
      <button
        type="button"
        onClick={onClear}
        disabled={disabled}
        className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--danger-solid)] text-white shadow-md transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="프로필 이미지 URL 삭제"
      >
        <Trash2 size={14} aria-hidden />
      </button>
    </div>
  );
}

function ProfileEditForm({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [profileImageUrl, setProfileImageUrl] = useState(profile.profileImageUrl ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // 제출 전에 바로 보이는 필드 단위 검증 — 형식 오류로 인한 재제출을 줄인다.
  const nameError = name.trim() ? "" : "표시 이름을 입력해주세요.";
  const imageUrlError =
    profileImageUrl.trim() && !isValidProfileImageUrl(profileImageUrl)
      ? "프로필 이미지 URL은 http:// 또는 https:// 로 시작해야 합니다."
      : "";

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
        { name: validation.name, profileImageUrl: validation.profileImageUrl, notifyCampaignUpdates: profile?.notifyCampaignUpdates ?? true, notifyMessages: profile?.notifyMessages ?? true },
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
        style={{ color: "var(--foreground)" }}
      >
        <ArrowLeft size={14} /> 마이페이지로 돌아가기
      </Link>

      <div
        className="rounded-3xl border p-6 shadow-[0_35px_75px_-30px_rgba(0,0,0,0.45)] sm:p-10"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <ProfileImagePreview
            name={name.trim() || profile.name}
            url={profileImageUrl}
            disabled={submitting}
            onClear={() => setProfileImageUrl("")}
          />
          <div>
            <h1
              style={{
                fontFamily: "var(--font-black-han), sans-serif",
                fontSize: "clamp(30px, 6vw, 42px)",
                color: "var(--foreground)",
              }}
            >
              프로필 편집
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
              표시 이름과 프로필 이미지를 변경할 수 있습니다.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-6">
          <div>
            <label htmlFor="profile-name" className="mb-2 block text-[13px]" style={{ color: "var(--foreground)" }}>
              표시 이름
            </label>
            <input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="name"
              disabled={submitting}
              aria-invalid={!!nameError}
              className="ui-control"
              style={{
                background: "var(--card)",
                borderColor: nameError ? "rgba(var(--danger-rgb),0.55)" : "var(--border)",
                color: "var(--foreground)",
              }}
            />
            <div className="mt-1 flex items-start justify-between gap-2">
              {nameError ? (
                <p role="alert" className="text-[12px] text-[var(--danger)]">{nameError}</p>
              ) : <span />}
              <p className="text-right text-[11px] opacity-50" style={{ color: "var(--foreground)" }}>
                {name.length}/{MAX_NAME_LENGTH}
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="profile-image-url" className="mb-2 block text-[13px]" style={{ color: "var(--foreground)" }}>
              프로필 이미지
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <input
                id="profile-image-url"
                value={profileImageUrl}
                onChange={(event) => setProfileImageUrl(event.target.value)}
                maxLength={MAX_PROFILE_IMAGE_URL_LENGTH}
                placeholder="https://example.com/avatar.png"
                disabled={submitting}
                aria-invalid={!!imageUrlError}
                className="ui-control min-w-0 flex-1"
                style={{
                  background: "var(--card)",
                  borderColor: imageUrlError ? "rgba(var(--danger-rgb),0.55)" : "var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <ImageFileUploadButton
                disabled={submitting}
                onUploaded={setProfileImageUrl}
              />
            </div>
            {imageUrlError ? (
              <p role="alert" className="mt-1 text-[12px] text-[var(--danger)]">{imageUrlError}</p>
            ) : null}
            <p className="mt-1 text-[11px] opacity-50" style={{ color: "var(--foreground)" }}>
              URL 입력 또는 파일 업로드(jpeg/png/webp, 5MB 이하). 비우면 기본 아바타가 표시됩니다.
            </p>
          </div>

          <div>
            <label htmlFor="profile-email" className="mb-2 block text-[13px]" style={{ color: "var(--foreground)" }}>
              이메일
            </label>
            <input
              id="profile-email"
              value={profile.email}
              readOnly
              aria-readonly="true"
              className="ui-control opacity-65"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>

          {error ? (
            <p role="alert" aria-live="polite" className="rounded-xl bg-[rgba(var(--danger-rgb),0.1)] px-4 py-3 text-[13px] text-[var(--danger)]">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Link
              href="/mypage"
              className="rounded-xl border px-6 py-3 text-center text-[13px]"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={submitting || !!nameError || !!imageUrlError}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-8 py-3 text-[13px] font-medium text-[var(--surface-dark)] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-50"
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

export default function ProfileEditClient() {
  const { profile, loading, error, isLoggedIn, retry } = useCurrentUserProfile();

  return (
    <PageShell paddingClassName="relative min-h-screen overflow-hidden px-6 pb-20 pt-28 sm:pt-32" orb="right">
      <div className="relative">
        {/* loading을 먼저 확인: hydration 전(로그인 미확정)에 비로그인 패널이 깜빡이지 않도록. */}
        {loading ? (
          <StatePanel className="mx-auto min-h-72 max-w-2xl">
            <RefreshCw size={28} className="animate-spin text-[var(--accent)]" />
            <p>사용자 정보를 불러오는 중입니다.</p>
          </StatePanel>
        ) : !isLoggedIn ? (
          <StatePanel className="mx-auto min-h-72 max-w-2xl">
            <LogIn size={30} className="text-[var(--accent)]" />
            <p>프로필을 수정하려면 로그인이 필요합니다.</p>
            <Link href="/login" className="rounded-full bg-[var(--accent)] px-5 py-2 text-[13px] text-[var(--surface-dark)]">
              로그인 페이지로 이동
            </Link>
          </StatePanel>
        ) : error || !profile ? (
          <StatePanel className="mx-auto min-h-72 max-w-2xl" role="alert">
            <p>{error || "사용자 정보를 불러오지 못했습니다."}</p>
            <button type="button" onClick={retry} className="rounded-full bg-[var(--accent)] px-5 py-2 text-[13px] text-[var(--surface-dark)]">
              다시 시도
            </button>
          </StatePanel>
        ) : (
          <ProfileEditForm key={`${profile.id}:${profile.name}:${profile.profileImageUrl ?? ""}`} profile={profile} />
        )}
      </div>
    </PageShell>
  );
}

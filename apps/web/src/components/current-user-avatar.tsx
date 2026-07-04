"use client";

import { Avatar } from "@/components/avatar";
import { getName } from "@/lib/auth";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";

/** 로그인 사용자 아바타 — 프로필 저장 후 PROFILE_EVENT 로 즉시 갱신된다. */
export function CurrentUserAvatar({ size = 32 }: { size?: number }) {
  const { profile } = useCurrentUserProfile();
  const name = profile?.name ?? getName() ?? "나";
  return (
    <Avatar
      name={name}
      verified={profile?.verified}
      size={size}
      src={profile?.profileImageUrl ?? undefined}
    />
  );
}

"use client";

import { RouteError } from "@/components/route-boundaries";

export default function UserProfileError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} label="프로필을 불러오지 못했습니다." />;
}

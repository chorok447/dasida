"use client";

import { RouteError } from "@/components/route-boundaries";

export default function PostDetailError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} label="게시글을 불러오지 못했습니다." />;
}

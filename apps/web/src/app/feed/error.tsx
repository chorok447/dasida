"use client";

import { RouteError } from "@/components/route-boundaries";

export default function FeedError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} label="피드를 불러오지 못했습니다." />;
}

"use client";

import { RouteError } from "@/components/route-boundaries";

export default function CampaignDetailError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} label="캠페인을 불러오지 못했습니다." />;
}

import { Suspense } from "react";
import { apiGet } from "@/lib/api";
import type { CampaignSearchResponse } from "@/data/campaigns";
import FeedClient from "./feed-client";

export default async function FeedPage() {
  const campaigns = await apiGet<CampaignSearchResponse>(
    "/api/campaigns/search?status=open&availableOnly=true&sort=popular&page=0&size=3",
  );
  return (
    <Suspense fallback={<FeedFallback />}>
      <FeedClient campaigns={campaigns.content} />
    </Suspense>
  );
}

function FeedFallback() {
  return (
    <section className="min-h-screen bg-[#f9f7f2] px-6 pb-20 pt-32 text-center text-[#1c4044]/60 dark:bg-[#0f1f22] dark:text-white/60">
      피드 검색 조건을 불러오는 중입니다.
    </section>
  );
}

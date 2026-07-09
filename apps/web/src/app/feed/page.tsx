import { Suspense } from "react";
import { apiGet } from "@/lib/api";
import type { CampaignSearchResponse } from "@/data/campaigns";
import FeedClient from "./feed-client";

// revalidate fetch 로 정적 프리렌더 대상이 되면 빌드가 살아있는 API 를 요구하게 된다.
// 페이지는 동적으로 두고(fetch 데이터 캐시 60초는 유지) 빌드 시점 API 의존을 없앤다.
export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const campaigns = await apiGet<CampaignSearchResponse>(
    "/api/campaigns/search?status=open&availableOnly=true&sort=popular&page=0&size=3",
    { revalidate: 60 },
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

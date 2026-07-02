import { Suspense } from "react";
import CampaignListClient from "./campaign-list-client";

function CampaignListFallback() {
  return (
    <section className="min-h-screen bg-[#f9f7f2] px-6 pb-20 pt-32 text-center text-[#1c4044]/60 dark:bg-[#0f1f22] dark:text-white/60">
      캠페인 검색 조건을 불러오는 중입니다.
    </section>
  );
}

export default function CampaignListPage() {
  return (
    <Suspense fallback={<CampaignListFallback />}>
      <CampaignListClient />
    </Suspense>
  );
}

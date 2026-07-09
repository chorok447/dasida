import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiGetOrNull } from "@/lib/api";
import type { Campaign } from "@/data/campaigns";
import CampaignDetailClient from "./campaign-detail-client";

// generateMetadata 와 페이지 본문이 같은 요청 안에서 fetch 를 공유하도록 dedupe.
// 캐싱(revalidate) 금지: 캠페인 수정 직후 상세 SSR 이 옛 내용을 내려주는 문제(post 상세와 동일).
const getCampaign = cache((id: string) => apiGetOrNull<Campaign>(`/api/campaigns/${id}`));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) return {};
  return {
    title: campaign.title,
    description: campaign.summary,
    openGraph: {
      title: campaign.title,
      description: campaign.summary,
      images: campaign.thumb ? [campaign.thumb] : undefined,
    },
  };
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();
  return <CampaignDetailClient campaign={campaign} />;
}

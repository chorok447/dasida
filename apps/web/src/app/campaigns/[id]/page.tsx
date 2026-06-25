import { notFound } from "next/navigation";
import { apiGetOrNull } from "@/lib/api";
import type { Campaign } from "@/data/campaigns";
import CampaignDetailClient from "./campaign-detail-client";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await apiGetOrNull<Campaign>(`/api/campaigns/${id}`);
  if (!campaign) notFound();
  return <CampaignDetailClient campaign={campaign} />;
}

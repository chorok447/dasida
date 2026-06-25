import { apiGet } from "@/lib/api";
import type { Campaign } from "@/data/campaigns";
import CampaignListClient from "./campaign-list-client";

export default async function CampaignListPage() {
  const campaigns = await apiGet<Campaign[]>("/api/campaigns");
  return <CampaignListClient campaigns={campaigns} />;
}

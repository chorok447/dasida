import CampaignEditClient from "./campaign-edit-client";

export default async function CampaignEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CampaignEditClient id={id} />;
}

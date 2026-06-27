import ParticipantsClient from "./participants-client";

export default async function CampaignParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ParticipantsClient id={id} />;
}

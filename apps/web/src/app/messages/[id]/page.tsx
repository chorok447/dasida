import { ConversationRoomClient } from "../conversation-room";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConversationRoomClient conversationId={id} />;
}

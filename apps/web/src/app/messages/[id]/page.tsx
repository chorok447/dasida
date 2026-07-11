import { ConversationRoomClient } from "../conversation-room";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // key 로 대화방마다 새 인스턴스를 강제한다. 없으면 같은 [id] 라우트를 재사용하며 스크롤/구독 관련
  // ref·상태가 이전 대화방 값으로 남아, 두 번째 대화방부터 최신 메시지로 스크롤되지 않는다.
  return <ConversationRoomClient key={id} conversationId={id} />;
}

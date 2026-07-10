import { apiDeleteVoid, apiGet, apiPost } from "@/lib/api";

export type MessagePreview = {
  id: string;
  content: string;
  senderId: number;
  createdAt: string;
  deleted?: boolean;
};

/** 대화 상대 요약. 백엔드 ConversationPeerResponse 와 1:1 — 카운트·팔로우 상태는 전체 프로필 API 로. */
export type ConversationPeer = {
  id: number;
  name: string;
  verified: boolean;
  profileImageUrl?: string | null;
};

export type ConversationSummary = {
  id: string;
  peer: ConversationPeer;
  lastMessage: MessagePreview | null;
  unreadCount: number;
  updatedAt: string;
};

export type ConversationPageResponse = {
  content: ConversationSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type ConversationUnreadCountResponse = {
  unreadCount: number;
};

export type MessageItem = {
  id: string;
  senderId: number;
  content: string;
  createdAt: string;
  mine: boolean;
  deleted?: boolean;
};

export type MessagePageResponse = {
  content: MessageItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export const DM_EVENT = "dasida-dm";

export type DmChangedDetail = {
  totalUnread?: number;
};

export function emitDmChanged(detail?: DmChangedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DmChangedDetail>(DM_EVENT, { detail }));
}

/** 대화방 나가기 — 본인 멤버십만 제거. 상대가 새 메시지를 보내면 방이 복원된다. */
export function leaveConversation(conversationId: string): Promise<void> {
  return apiDeleteVoid(`/api/messages/conversations/${encodeURIComponent(conversationId)}`);
}

/** 본인 메시지 삭제(soft delete). 삭제 후 본문은 서버가 마스킹한다. */
export function deleteMessage(conversationId: string, messageId: string): Promise<void> {
  return apiDeleteVoid(
    `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
  );
}

export function createConversation(peerUserId: number): Promise<ConversationSummary> {
  return apiPost<ConversationSummary>("/api/messages/conversations", { peerUserId });
}

export function fetchConversations(page: number, size = 20): Promise<ConversationPageResponse> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return apiGet<ConversationPageResponse>(`/api/messages/conversations?${params.toString()}`);
}

export function fetchDmUnreadCount(): Promise<ConversationUnreadCountResponse> {
  return apiGet<ConversationUnreadCountResponse>("/api/messages/conversations/unread-count");
}

export function fetchConversation(conversationId: string): Promise<ConversationSummary> {
  return apiGet<ConversationSummary>(`/api/messages/conversations/${conversationId}`);
}

export function fetchMessages(conversationId: string, page: number, size = 50): Promise<MessagePageResponse> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return apiGet<MessagePageResponse>(`/api/messages/conversations/${conversationId}/messages?${params.toString()}`);
}

export async function sendMessage(conversationId: string, content: string): Promise<MessageItem> {
  const res = await apiPost<MessageItem>(`/api/messages/conversations/${conversationId}/messages`, { content });
  emitDmChanged();
  return res;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await apiPost<{ read: boolean }>(`/api/messages/conversations/${conversationId}/read`, {});
  emitDmChanged();
}

export function mergeConversationList(
  items: ConversationSummary[],
  patch: ConversationSummary,
  page: number,
): ConversationSummary[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  if (byId.has(patch.id)) byId.set(patch.id, patch);
  else if (page === 0) byId.set(patch.id, patch);
  return [...byId.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function relativeDmTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일`;
  return new Date(then).toLocaleDateString("ko-KR");
}

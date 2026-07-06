import { apiGet, apiPost } from "@/lib/api";
import type { PublicUser } from "@/data/users";

export type MessagePreview = {
  id: string;
  content: string;
  senderId: number;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  peer: PublicUser;
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
};

export type MessagePageResponse = {
  content: MessageItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export const DM_EVENT = "dasida-dm";

export function emitDmChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DM_EVENT));
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

import { getClientApiBaseUrl } from "@/lib/api-url";
import { emitDmChanged, type ConversationSummary, type MessageItem } from "@/data/messages";
import { emitNotificationsChanged } from "@/data/notifications";

export type DmWsMessagePayload = {
  id: string;
  senderId: number;
  content: string;
  createdAt: string;
};

export type DmWsHandlers = {
  viewerId: number | null;
  onMessage?: (conversationId: string, msg: MessageItem) => void;
  onTyping?: (conversationId: string, userId: number, active: boolean) => void;
  onRead?: (conversationId: string, userId: number, lastReadMessageId: string | null) => void;
  onPresence?: (conversationId: string, userId: number, online: boolean) => void;
  onInbox?: (summary: ConversationSummary, totalUnread: number) => void;
};

export type DmSocket = {
  subscribe: (conversationId: string) => void;
  unsubscribe: (conversationId: string) => void;
  sendTyping: (conversationId: string, active: boolean) => void;
  close: () => void;
};

function wsUrl(): string {
  return `${getClientApiBaseUrl().replace(/^http/, "ws")}/ws/messages`;
}

/** 단일 연결·자동 재연결. JWT는 httpOnly 쿠키로 핸드셰이크에 실린다. */
export function openDmSocket(handlers: DmWsHandlers): DmSocket {
  let ws: WebSocket | null = null;
  let closed = false;
  let retryMs = 1500;
  let reconnectTimer: number | null = null;
  const pendingSubs = new Set<string>();

  const send = (data: object) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  };

  const flushSubs = () => {
    pendingSubs.forEach((id) => send({ type: "subscribe", conversationId: id }));
  };

  const connect = () => {
    if (closed) return;
    ws = new WebSocket(wsUrl());
    ws.onopen = () => {
      retryMs = 1500;
      flushSubs();
    };
    ws.onmessage = (event) => {
      let frame: { type?: string; conversationId?: string; payload?: Record<string, unknown> };
      try {
        frame = JSON.parse(String(event.data)) as typeof frame;
      } catch {
        return;
      }
      const { type, conversationId, payload } = frame;
      if (!type || !payload) return;
      // 알림 배지 갱신 — 대화와 무관한 사용자 단위 이벤트라 conversationId 없이 온다.
      if (type === "notification") {
        if (typeof payload.unreadCount === "number") {
          emitNotificationsChanged({ unreadCount: payload.unreadCount });
        }
        return;
      }
      if (!conversationId) return;
      const viewerId = handlers.viewerId;

      if (type === "message") {
        const p = payload as DmWsMessagePayload;
        const mine = viewerId != null && p.senderId === viewerId;
        handlers.onMessage?.(conversationId, {
          id: p.id,
          senderId: p.senderId,
          content: p.content,
          createdAt: p.createdAt,
          mine,
        });
        return;
      }
      if (type === "typing" && typeof payload.userId === "number") {
        handlers.onTyping?.(conversationId, payload.userId, payload.active !== false);
        return;
      }
      if (type === "read" && typeof payload.userId === "number") {
        const last = typeof payload.lastReadMessageId === "string" ? payload.lastReadMessageId : null;
        handlers.onRead?.(conversationId, payload.userId, last);
        return;
      }
      if (type === "presence" && typeof payload.userId === "number") {
        handlers.onPresence?.(conversationId, payload.userId, payload.online === true);
        return;
      }
      if (type === "inbox") {
        const parsed = parseInboxPayload(payload);
        if (parsed) {
          handlers.onInbox?.(parsed.summary, parsed.totalUnread);
          emitDmChanged({ totalUnread: parsed.totalUnread });
        }
      }
    };
    ws.onclose = () => {
      // 열리기 전에 실패한 시도도 재시도를 이어간다(서버 재기동 중 끊기면 체인이 영구 중단되던 버그).
      // 성공 연결 후 끊긴 경우의 백오프 초기화는 onopen 의 retryMs 리셋이 담당한다.
      if (closed) return;
      reconnectTimer = window.setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 15_000);
    };
  };

  connect();

  return {
    subscribe(conversationId: string) {
      pendingSubs.add(conversationId);
      send({ type: "subscribe", conversationId });
    },
    unsubscribe(conversationId: string) {
      pendingSubs.delete(conversationId);
      send({ type: "unsubscribe", conversationId });
    },
    sendTyping(conversationId: string, active: boolean) {
      send({ type: "typing", conversationId, active });
    },
    close() {
      closed = true;
      if (reconnectTimer != null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      ws?.close();
      ws = null;
    },
  };
}

function parseInboxPayload(payload: Record<string, unknown>): { summary: ConversationSummary; totalUnread: number } | null {
  const summaryNode = payload.summary;
  const totalUnread = payload.totalUnread;
  if (typeof totalUnread !== "number" || !summaryNode || typeof summaryNode !== "object") return null;
  const summary = parseConversationSummary(summaryNode as Record<string, unknown>);
  return summary ? { summary, totalUnread } : null;
}

function parseConversationSummary(payload: Record<string, unknown>): ConversationSummary | null {
  const id = payload.id;
  const peer = payload.peer;
  const updatedAt = payload.updatedAt;
  if (typeof id !== "string" || typeof updatedAt !== "string" || !peer || typeof peer !== "object") return null;
  const p = peer as Record<string, unknown>;
  if (typeof p.id !== "number" || typeof p.name !== "string") return null;
  const lastMessage = payload.lastMessage;
  let preview: ConversationSummary["lastMessage"] = null;
  if (lastMessage && typeof lastMessage === "object") {
    const m = lastMessage as Record<string, unknown>;
    if (
      typeof m.id === "string" &&
      typeof m.content === "string" &&
      typeof m.senderId === "number" &&
      typeof m.createdAt === "string"
    ) {
      preview = { id: m.id, content: m.content, senderId: m.senderId, createdAt: m.createdAt, deleted: m.deleted === true };
    }
  }
  return {
    id,
    peer: {
      id: p.id,
      name: p.name,
      verified: p.verified === true,
      profileImageUrl: typeof p.profileImageUrl === "string" ? p.profileImageUrl : null,
    },
    lastMessage: preview,
    unreadCount: typeof payload.unreadCount === "number" ? payload.unreadCount : 0,
    updatedAt,
  };
}

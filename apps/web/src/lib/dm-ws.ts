import { getClientApiBaseUrl } from "@/lib/api-url";
import { emitDmChanged, type MessageItem } from "@/data/messages";

export type DmWsMessagePayload = {
  id: string;
  senderId: number;
  content: string;
  createdAt: string;
};

type Handlers = {
  viewerId: number | null;
  onMessage?: (conversationId: string, msg: MessageItem) => void;
  onTyping?: (conversationId: string, userId: number, active: boolean) => void;
  onRead?: (conversationId: string, userId: number, lastReadMessageId: string | null) => void;
  onPresence?: (conversationId: string, userId: number, online: boolean) => void;
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

/** ponytail: 단일 연결·자동 재연결. JWT는 httpOnly 쿠키로 핸드셰이크에 실린다. */
export function openDmSocket(handlers: Handlers): DmSocket {
  let ws: WebSocket | null = null;
  let closed = false;
  let retryMs = 1500;
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
      if (!type || !conversationId || !payload) return;
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
        emitDmChanged();
        return;
      }
      if (type === "typing" && typeof payload.userId === "number") {
        handlers.onTyping?.(conversationId, payload.userId, payload.active !== false);
        return;
      }
      if (type === "read" && typeof payload.userId === "number") {
        const last = typeof payload.lastReadMessageId === "string" ? payload.lastReadMessageId : null;
        handlers.onRead?.(conversationId, payload.userId, last);
        emitDmChanged();
        return;
      }
      if (type === "presence" && typeof payload.userId === "number") {
        handlers.onPresence?.(conversationId, payload.userId, payload.online === true);
      }
    };
    ws.onclose = () => {
      if (closed) return;
      window.setTimeout(connect, retryMs);
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
      ws?.close();
      ws = null;
    },
  };
}

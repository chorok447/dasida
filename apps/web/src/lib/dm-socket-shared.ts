import {
  openDmSocket,
  type DmSocket,
  type DmWsHandlers,
} from "@/lib/dm-ws";

export type { DmWsHandlers };

type HandlerEntry = () => DmWsHandlers;

const handlers = new Set<HandlerEntry>();
const subCounts = new Map<string, number>();
let socket: DmSocket | null = null;

// ponytail: pagehide 시 재연결 타이머가 Playwright teardown 을 막는 걸 방지
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    socket?.close();
    socket = null;
  });
}

type HandlerKey = Exclude<keyof DmWsHandlers, "viewerId">;

function dispatch<K extends HandlerKey>(
  key: K,
  ...args: Parameters<NonNullable<DmWsHandlers[K]>>
) {
  for (const entry of handlers) {
    const handler = entry()[key];
    if (handler) {
      (handler as (...a: typeof args) => void)(...args);
    }
  }
}

function ensureSocket(): DmSocket {
  if (socket) return socket;
  socket = openDmSocket({
    shouldReconnect: () => handlers.size > 0 && document.visibilityState === "visible",
    getViewerId: () => {
      for (const entry of handlers) {
        const id = entry().viewerId;
        if (id != null) return id;
      }
      return null;
    },
    onMessage: (...args) => dispatch("onMessage", ...args),
    onTyping: (...args) => dispatch("onTyping", ...args),
    onRead: (...args) => dispatch("onRead", ...args),
    onPresence: (...args) => dispatch("onPresence", ...args),
    onInbox: (...args) => dispatch("onInbox", ...args),
  });
  for (const [conversationId, count] of subCounts) {
    for (let i = 0; i < count; i += 1) socket.subscribe(conversationId);
  }
  return socket;
}

/** 앱 전역 단일 DM WebSocket — 헤더·목록·채팅방이 공유한다. */
export function registerDmHandlers(getHandlers: HandlerEntry): () => void {
  handlers.add(getHandlers);
  ensureSocket();
  return () => {
    handlers.delete(getHandlers);
    if (handlers.size === 0) {
      socket?.close();
      socket = null;
    }
  };
}

export function dmSubscribe(conversationId: string): () => void {
  const next = (subCounts.get(conversationId) ?? 0) + 1;
  subCounts.set(conversationId, next);
  if (next === 1) ensureSocket().subscribe(conversationId);
  return () => {
    const left = (subCounts.get(conversationId) ?? 1) - 1;
    if (left <= 0) {
      subCounts.delete(conversationId);
      socket?.unsubscribe(conversationId);
    } else {
      subCounts.set(conversationId, left);
    }
  };
}

export function dmSendTyping(conversationId: string, active: boolean) {
  if (handlers.size === 0) return;
  ensureSocket().sendTyping(conversationId, active);
}

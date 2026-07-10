"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { AuthorHeader } from "@/components/author-header";
import { PageShell } from "@/components/page-shell";
import { useAuthSession } from "@/lib/use-auth-session";
import { ApiError } from "@/lib/api";
import { beginAuthedRequest, clearSessionIfUnauthorized } from "@/lib/authed-request";
import {
  fetchConversation,
  fetchMessages,
  markConversationRead,
  sendMessage,
  type MessageItem,
} from "@/data/messages";
import type { PublicUser } from "@/data/users";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import { openDmSocket, type DmSocket } from "@/lib/dm-ws";

function dmDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "오늘";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, yesterday)) return "어제";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export function ConversationRoomClient({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const { sessionId: token, isLoggedIn, hydrated } = useAuthSession();
  const { profile } = useCurrentUserProfile();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [peer, setPeer] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerReadMessageId, setPeerReadMessageId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const generationRef = useRef(0);
  const socketRef = useRef<DmSocket | null>(null);

  useEffect(() => {
    if (hydrated && !isLoggedIn) router.replace(`/login?next=/messages/${conversationId}`);
  }, [hydrated, isLoggedIn, router, conversationId]);

  useEffect(() => {
    const requestToken = token;
    if (!requestToken) return;
    const guard = beginAuthedRequest(generationRef, requestToken);

    Promise.all([
      fetchMessages(conversationId, 0, 100),
      fetchConversation(conversationId),
    ])
      .then(([res, conv]) => {
        if (!guard.isCurrent()) return;
        const chronological = [...res.content].reverse();
        setMessages(chronological);
        setPeer(conv.peer);
        // 읽음 처리 실패가 "불러오기 실패" 토스트로 이어지지 않게 로드 에러 처리와 분리한다.
        markConversationRead(conversationId).catch(() => {});
      })
      .catch((error) => {
        if (!guard.isCurrent()) return;
        if (clearSessionIfUnauthorized(error, requestToken)) return;
        if (error instanceof ApiError && error.status === 403) {
          toast.error("이 대화에 접근할 수 없어요.");
          router.push("/messages");
          return;
        }
        toast.error("메시지를 불러오지 못했어요.");
      })
      .finally(() => {
        if (guard.isCurrent()) setLoading(false);
      });

    return guard.cancel;
  }, [conversationId, token, router]);

  useEffect(() => {
    if (!token) return;
    const viewerId = profile?.id ?? null;
    const sock = openDmSocket({
      viewerId,
      onMessage: (convId, msg) => {
        if (convId !== conversationId) return;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        // 방을 보고 있는 동안 도착한 상대 메시지는 즉시 읽음 처리(배지·읽음영수증 동기화).
        if (viewerId != null && msg.senderId !== viewerId && document.visibilityState === "visible") {
          markConversationRead(conversationId).catch(() => {});
        }
      },
      onTyping: (convId, userId, active) => {
        if (convId !== conversationId || userId === viewerId) return;
        setPeerTyping(active);
      },
      onRead: (convId, userId, lastReadMessageId) => {
        if (convId !== conversationId || userId === viewerId) return;
        setPeerReadMessageId(lastReadMessageId);
      },
      onPresence: (convId, userId, online) => {
        if (convId !== conversationId || userId === viewerId) return;
        setPeerOnline(online);
      },
    });
    socketRef.current = sock;
    sock.subscribe(conversationId);
    return () => {
      sock.unsubscribe(conversationId);
      sock.close();
      socketRef.current = null;
      setPeerTyping(false);
      setPeerOnline(false);
    };
  }, [conversationId, token, profile?.id]);

  useEffect(() => {
    const sock = socketRef.current;
    if (!sock || !draft.trim()) {
      sock?.sendTyping(conversationId, false);
      return;
    }
    const start = window.setTimeout(() => sock.sendTyping(conversationId, true), 300);
    const stop = window.setTimeout(() => sock.sendTyping(conversationId, false), 2500);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(stop);
    };
  }, [draft, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const sent = await sendMessage(conversationId, text);
      setDraft("");
      setMessages((prev) => [...prev, sent]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error("메시지를 보낼 수 없어요. (차단됨)");
      } else {
        toast.error("메시지 전송에 실패했어요.");
      }
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void onSend();
    }
  };

  // WS 에코가 profile 로드 전에 도착하면 mine=false 로 저장될 수 있어, 렌더 시점의 profile 로 재판정한다.
  const isMine = (msg: MessageItem) => (profile?.id != null ? msg.senderId === profile.id : msg.mine);

  const lastMineIndex = messages.reduce<number | null>((acc, msg, idx) => (isMine(msg) ? idx : acc), null);
  const readThroughIndex = peerReadMessageId
    ? messages.findIndex((m) => m.id === peerReadMessageId)
    : -1;
  const showReadReceipt =
    lastMineIndex != null && readThroughIndex >= 0 && readThroughIndex >= lastMineIndex;

  return (
    <PageShell paddingClassName="relative flex min-h-screen flex-col" orb="none">
      <h1 className="sr-only">{peer ? `${peer.name}님과의 대화` : "대화"}</h1>
      <header
        className="fixed top-16 left-0 right-0 z-30 border-b backdrop-blur-xl"
        style={{
          background: "rgba(var(--surface-rgb), 0.93)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            href="/messages"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: "rgba(var(--ink-rgb), 0.07)" }}
            aria-label="대화 목록으로"
          >
            <ArrowLeft size={18} />
          </Link>
          {peer ? (
            <div className="min-w-0 flex-1">
              <AuthorHeader
                name={peer.name}
                verified={peer.verified}
                profileImageUrl={peer.profileImageUrl}
                authorId={peer.id}
                avatarSize={36}
              />
              {peerOnline ? (
                <p className="mt-0.5 text-[11px] text-[#7dd3a3]">온라인</p>
              ) : null}
            </div>
          ) : (
            <span className="text-[14px] opacity-70">대화</span>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-36 pb-28">
        {loading ? (
          <p className="text-center text-[13px] opacity-60" style={{ color: "var(--foreground)" }}>
            불러오는 중…
          </p>
        ) : messages.length === 0 ? (
          <p className="text-center text-[13px] opacity-60" style={{ color: "var(--foreground-muted)" }}>
            첫 메시지를 보내 보세요.
          </p>
        ) : (
          <ul className="flex flex-1 flex-col gap-2">
            {(() => {
              let lastDate = "";
              return messages.flatMap((msg) => {
                const dateLabel = dmDateLabel(msg.createdAt);
                const items = [];
                if (dateLabel && dateLabel !== lastDate) {
                  lastDate = dateLabel;
                  items.push(
                    <li key={`date-${msg.id}`} className="py-2 text-center text-[11px] opacity-50" style={{ color: "var(--foreground-muted)" }}>
                      {dateLabel}
                    </li>,
                  );
                }
                const mine = isMine(msg);
                items.push(
                  <li key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words"
                      style={{
                        background: mine
                          ? "rgba(125,211,163,0.35)"
                          : "rgba(var(--ink-rgb), 0.07)",
                        color: "var(--foreground)",
                      }}
                    >
                      {msg.content}
                    </div>
                  </li>,
                );
                return items;
              });
            })()}
          </ul>
        )}
        {peerTyping ? (
          <p className="text-[12px] opacity-60" style={{ color: "var(--foreground-muted)" }}>
            입력 중…
          </p>
        ) : null}
        {showReadReceipt ? (
          <p className="text-right text-[11px] opacity-50" style={{ color: "var(--foreground-muted)" }}>
            읽음
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div
        className="fixed bottom-14 left-0 right-0 z-30 border-t backdrop-blur-xl md:bottom-0"
        style={{
          background: "rgba(var(--surface-rgb), 0.95)",
          borderColor: "var(--border)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2 px-4 py-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="메시지 입력 (Enter 전송, Shift+Enter 줄바꿈)"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#7dd3a3]/40"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
          />
          <button
            type="button"
            onClick={() => void onSend()}
            disabled={sending || !draft.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
            style={{ background: "#7dd3a3", color: "#0f1f22" }}
            aria-label="전송"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </PageShell>
  );
}

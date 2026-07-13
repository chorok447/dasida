"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { AuthorHeader } from "@/components/author-header";
import { PageShell } from "@/components/page-shell";
import { useAuthSession } from "@/lib/use-auth-session";
import { ApiError } from "@/lib/api";
import { beginAuthedRequest, clearSessionIfUnauthorized } from "@/lib/authed-request";
import {
  deleteMessage,
  fetchConversation,
  leaveConversation,
  fetchMessages,
  markConversationRead,
  sendMessage,
  type ConversationPeer,
  type MessageItem,
} from "@/data/messages";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import { useConfirm } from "@/components/ui/confirm-dialog";
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

// 백엔드 MessageService.MAX_CONTENT 와 동일. 초과 입력은 전송 시 400 이 나므로 입력 단계에서 막는다.
const MAX_MESSAGE_LENGTH = 2000;
// 남은 글자수가 이보다 적어지면 카운터를 노출한다(평소엔 채팅 입력을 깔끔하게 유지).
const MESSAGE_COUNTER_THRESHOLD = 200;

export function ConversationRoomClient({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const { sessionId: token, isLoggedIn, hydrated } = useAuthSession();
  const { profile } = useCurrentUserProfile();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState(false);
  const confirm = useConfirm();
  const [peer, setPeer] = useState<ConversationPeer | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerReadMessageId, setPeerReadMessageId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // 사용자가 바닥 근처를 보고 있는지(=새 메시지를 따라 스크롤해도 되는지)와 최초 로드 여부.
  const nearBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
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
      onMessageDeleted: (convId, messageId) => {
        if (convId !== conversationId) return;
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, deleted: true, content: "" } : m)));
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

  // DM 은 페이지(창) 스크롤을 쓴다. 바닥 근처 여부를 추적해 자동 스크롤 여부를 정한다.
  // 모바일 소프트 키보드 등 스크롤 이벤트 없는 레이아웃 변화(resize)도 반영한다.
  useEffect(() => {
    const update = () => {
      nearBottomRef.current =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    // 최초 로드가 끝나면(빈 대화 포함) 한 번 최신 위치로 즉시 이동한 뒤 증분 처리로 넘어간다.
    // loading 을 기준 삼아, 빈 대화방의 첫 라이브 메시지도 초기 점프가 아니라 부드럽게 따라가게 한다.
    if (loading) return;
    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      bottomRef.current?.scrollIntoView();
      return;
    }
    // 이후 메시지는 바닥 근처일 때만 부드럽게 따라간다(위로 올려 옛 메시지 읽는 중엔 위치 유지).
    if (nearBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const sent = await sendMessage(conversationId, text);
      setDraft("");
      // 내가 보낸 메시지는 스크롤 위치와 무관하게 항상 따라가 바로 보이게 한다.
      nearBottomRef.current = true;
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

  const removeMessage = async (messageId: string) => {
    if (deletingIds.has(messageId)) return;
    setDeletingIds((prev) => new Set(prev).add(messageId));
    try {
      await deleteMessage(conversationId, messageId);
      // 서버가 본문을 마스킹하므로 로컬도 동일하게 표시만 바꾼다(WS 실시간 반영은 후속).
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, deleted: true, content: "" } : m)));
    } catch {
      toast.error("메시지 삭제에 실패했습니다.");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  };

  const onLeave = async () => {
    if (leaving) return;
    const ok = await confirm({
      title: "대화방을 나갈까요?",
      message: "내 목록에서 대화가 사라져요. 상대가 새 메시지를 보내면 다시 표시됩니다.",
      confirmLabel: "나가기",
      destructive: true,
    });
    if (!ok) return;
    setLeaving(true);
    try {
      await leaveConversation(conversationId);
      router.push("/messages");
    } catch {
      toast.error("대화방 나가기에 실패했습니다.");
      setLeaving(false);
    }
  };

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
                <p className="mt-0.5 text-[11px] text-[var(--accent)]">온라인</p>
              ) : null}
            </div>
          ) : (
            <span className="text-[14px] opacity-70">대화</span>
          )}
          <button
            type="button"
            onClick={() => void onLeave()}
            disabled={leaving}
            aria-label="대화방 나가기"
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
            style={{ background: "rgba(var(--ink-rgb), 0.07)", color: "var(--foreground-muted)" }}
          >
            <LogOut size={16} aria-hidden />
          </button>
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
                  <li key={msg.id} className={`group flex items-center gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
                    {mine && !msg.deleted ? (
                      <button
                        type="button"
                        onClick={() => void removeMessage(msg.id)}
                        disabled={deletingIds.has(msg.id)}
                        aria-label="메시지 삭제"
                        className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-60 hover:!opacity-100 disabled:opacity-30"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        <Trash2 size={13} aria-hidden />
                      </button>
                    ) : null}
                    <div
                      className="max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words"
                      style={{
                        background: mine
                          ? "rgba(var(--accent-rgb),0.35)"
                          : "rgba(var(--ink-rgb), 0.07)",
                        color: msg.deleted ? "var(--foreground-muted)" : "var(--foreground)",
                        fontStyle: msg.deleted ? "italic" : undefined,
                      }}
                    >
                      {msg.deleted ? "삭제된 메시지입니다" : msg.content}
                    </div>
                  </li>,
                );
                return items;
              });
            })()}
          </ul>
        )}
        {peerTyping ? (
          <p
            className="text-[12px] opacity-60"
            style={{ color: "var(--foreground-muted)" }}
            role="status"
            aria-label="상대방이 메시지를 입력 중입니다"
          >
            입력 중…
          </p>
        ) : null}
        {showReadReceipt ? (
          <p
            className="text-right text-[11px] opacity-50"
            style={{ color: "var(--foreground-muted)" }}
            role="status"
            aria-label="상대방이 메시지를 읽었습니다"
          >
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
        <div className="mx-auto max-w-2xl px-4 py-3">
          {draft.length > MAX_MESSAGE_LENGTH - MESSAGE_COUNTER_THRESHOLD ? (
            <p
              className="mb-1 pr-1 text-right text-[11px] tabular-nums"
              style={{
                color: draft.length >= MAX_MESSAGE_LENGTH ? "var(--warning)" : "var(--foreground-muted)",
              }}
              aria-live="polite"
            >
              {draft.length}/{MAX_MESSAGE_LENGTH}
            </p>
          ) : null}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={MAX_MESSAGE_LENGTH}
              aria-label="메시지 입력"
              placeholder="메시지 입력 (Enter 전송, Shift+Enter 줄바꿈)"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[rgba(var(--accent-rgb),0.4)]"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
            />
            <button
              type="button"
              onClick={() => void onSend()}
              disabled={sending || !draft.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
              aria-label="전송"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PageShell } from "@/components/page-shell";
import { PaginatedSection } from "@/app/mypage/paginated-section";
import { useAuthSession } from "@/lib/use-auth-session";
import {
  fetchConversations,
  mergeConversationList,
  relativeDmTime,
  type ConversationSummary,
} from "@/data/messages";
import { openDmSocket } from "@/lib/dm-ws";

export function ConversationListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Math.max(0, Number(searchParams.get("page") ?? "0") || 0);
  const { isLoggedIn, hydrated } = useAuthSession();

  useEffect(() => {
    if (hydrated && !isLoggedIn) router.replace("/login?next=/messages");
  }, [hydrated, isLoggedIn, router]);

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 0) params.delete("page");
    else params.set("page", String(next));
    const q = params.toString();
    router.push(q ? `/messages?${q}` : "/messages");
  };

  return (
    <PageShell paddingClassName="relative min-h-screen" orb="left">
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-28 sm:px-6">
        <h1
          className="mb-6"
          style={{
            fontFamily: "var(--font-black-han), sans-serif",
            fontSize: "clamp(28px, 5vw, 36px)",
            color: "var(--foreground)",
          }}
        >
          메시지
        </h1>
        <ConversationListBody key={page} page={page} onPageChange={setPage} />
      </div>
    </PageShell>
  );
}

function ConversationListBody({
  page,
  onPageChange,
}: {
  page: number;
  onPageChange: (page: number) => void;
}) {
  const { isLoggedIn } = useAuthSession();
  const [inboxPatches, setInboxPatches] = useState<ConversationSummary[]>([]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const sock = openDmSocket({
      viewerId: null,
      onInbox: (summary) => {
        setInboxPatches((current) => {
          const rest = current.filter((item) => item.id !== summary.id);
          return [...rest, summary];
        });
      },
    });
    return () => sock.close();
  }, [isLoggedIn]);

  const mergeList = useCallback(
    (items: ConversationSummary[]) => {
      let merged = items;
      for (const patch of inboxPatches) {
        merged = mergeConversationList(merged, patch, page);
      }
      return merged;
    },
    [inboxPatches, page],
  );

  return (
    <>
        <PaginatedSection
          identityKey="dm-list"
          page={page}
          onPageChange={onPageChange}
          fetcher={(p) => fetchConversations(p, 20)}
          loadingLabel="대화 목록 불러오는 중"
          errorLabel="대화 목록을 불러오지 못했어요."
          empty={
            <div
              className="rounded-2xl border px-6 py-12 text-center"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <MessageCircle size={32} className="mx-auto mb-3 opacity-50" aria-hidden />
              <p style={{ color: "var(--foreground)" }}>아직 대화가 없어요</p>
              <p className="mt-2 text-[13px] opacity-70" style={{ color: "var(--foreground-muted)" }}>
                팔로우한 사람의 프로필에서 메시지를 보내 보세요.
              </p>
              <Link
                href="/feed"
                className="mt-4 inline-block rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]"
              >
                피드로 이동
              </Link>
            </div>
          }
          renderItems={(items) => (
            <ul className="space-y-2">
              {mergeList(items).map((item) => (
                <ConversationRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        />
    </>
  );
}

function ConversationRow({ item }: { item: ConversationSummary }) {
  const preview = item.lastMessage?.content ?? "대화를 시작해 보세요";
  const time = item.lastMessage?.createdAt ?? item.updatedAt;
  return (
    <li>
      <Link
        href={`/messages/${item.id}`}
        className="flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:bg-[#7dd3a3]/8"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <Avatar
          name={item.peer.name}
          verified={item.peer.verified}
          size={48}
          src={item.peer.profileImageUrl ?? undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[15px] font-medium" style={{ color: "var(--foreground)" }}>
              {item.peer.name}
            </span>
            <span className="shrink-0 text-[11px] opacity-60" style={{ color: "var(--foreground)" }}>
              {relativeDmTime(time)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[13px] opacity-70" style={{ color: "var(--foreground-muted)" }}>
            {preview}
          </p>
        </div>
        {item.unreadCount > 0 ? (
          <span
            className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
            style={{ background: "var(--danger-solid)", color: "#fff" }}
          >
            {item.unreadCount > 99 ? "99+" : item.unreadCount}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

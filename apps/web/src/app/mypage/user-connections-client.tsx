"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ListEmptyState } from "@/components/list-empty-state";
import { PageShell } from "@/components/page-shell";
import {
  fetchMyBlockedPage,
  fetchMyFollowersPage,
  fetchMyFollowingPage,
  unblockUser,
  type PublicUser,
} from "@/data/users";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import { PaginatedSection } from "@/app/mypage/paginated-section";

type ConnectionsMode = "following" | "followers" | "blocked";

const MODE_META: Record<ConnectionsMode, { title: string; fetcher: (page: number) => ReturnType<typeof fetchMyFollowingPage>; loginHint: string }> = {
  following: { title: "팔로잉", fetcher: fetchMyFollowingPage, loginHint: "팔로우 목록은 로그인 후 확인할 수 있어요." },
  followers: { title: "팔로워", fetcher: fetchMyFollowersPage, loginHint: "팔로우 목록은 로그인 후 확인할 수 있어요." },
  blocked: { title: "차단 사용자", fetcher: fetchMyBlockedPage, loginHint: "차단 목록은 로그인 후 확인할 수 있어요." },
};

function UserRow({ user, onUnblock, unblocking }: { user: PublicUser; onUnblock?: () => void; unblocking?: boolean }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border p-4"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <Link href={`/users/${user.id}`} className="flex min-w-0 flex-1 items-center gap-3 transition-transform hover:-translate-y-0.5">
        <Avatar name={user.name} verified={user.verified} src={user.profileImageUrl ?? undefined} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
            {user.name}
          </p>
          <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
            게시글 {user.postCount.toLocaleString("ko-KR")}개
          </p>
        </div>
      </Link>
      {onUnblock ? (
        <button
          type="button"
          onClick={onUnblock}
          disabled={unblocking}
          aria-label={`${user.name} 차단 해제`}
          className="shrink-0 rounded-full border px-4 py-2 text-[12px] disabled:opacity-40"
          style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--card)" }}
        >
          {unblocking ? "해제 중…" : "차단 해제"}
        </button>
      ) : null}
    </div>
  );
}

export function UserConnectionsClient({ mode }: { mode: ConnectionsMode }) {
  const { isLoggedIn, loading } = useCurrentUserProfile();
  const [page, setPage] = useState(0);
  const [unblockingIds, setUnblockingIds] = useState<Set<number>>(new Set());
  const { title, fetcher, loginHint } = MODE_META[mode];

  const handleUnblock = async (user: PublicUser, reload: () => void) => {
    if (unblockingIds.has(user.id)) return;
    setUnblockingIds((prev) => new Set(prev).add(user.id));
    try {
      await unblockUser(user.id);
      toast.success(`${user.name}님 차단을 해제했어요.`);
      reload();
    } catch {
      toast.error("차단 해제에 실패했습니다.");
    } finally {
      setUnblockingIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  };

  return (
    <PageShell paddingClassName="relative min-h-screen overflow-hidden" orb="right">
      <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-28 sm:px-8 sm:pt-32">
        <Link
          href="/mypage"
          className="mb-6 inline-flex items-center gap-2 text-[13px]"
          style={{ color: "var(--foreground-muted)" }}
        >
          <ArrowLeft size={14} aria-hidden />
          마이페이지
        </Link>
        <h1
          className="mb-6"
          style={{ fontFamily: "var(--font-black-han), sans-serif", fontSize: 28, color: "var(--foreground)" }}
        >
          {title}
        </h1>

        {!loading && !isLoggedIn ? (
          <ListEmptyState
            title="로그인이 필요해요."
            description={loginHint}
            action={
              <Link href="/login" className="rounded-full bg-[var(--accent)] px-5 py-2 text-[13px] text-[var(--surface-dark)]">
                로그인
              </Link>
            }
          />
        ) : (
          <PaginatedSection
            identityKey={mode}
            page={page}
            onPageChange={setPage}
            fetcher={(p) => fetcher(p)}
            loadingLabel={`${title} 목록을 불러오는 중입니다.`}
            errorLabel={`${title} 목록을 불러오지 못했습니다.`}
            empty={
              <ListEmptyState
                title={mode === "blocked" ? "차단한 사용자가 없어요." : `${title} 목록이 비어 있어요.`}
              />
            }
            renderItems={(users, reload) => (
              <div className="grid gap-3">
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onUnblock={mode === "blocked" ? () => void handleUnblock(user, reload) : undefined}
                    unblocking={unblockingIds.has(user.id)}
                  />
                ))}
              </div>
            )}
          />
        )}
      </div>
    </PageShell>
  );
}

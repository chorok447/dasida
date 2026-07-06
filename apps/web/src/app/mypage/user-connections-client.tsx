"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ListEmptyState } from "@/components/list-empty-state";
import { PageShell } from "@/components/page-shell";
import {
  fetchMyFollowersPage,
  fetchMyFollowingPage,
  type PublicUser,
} from "@/data/users";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import { PaginatedSection } from "@/app/mypage/paginated-section";

function UserRow({ user }: { user: PublicUser }) {
  return (
    <Link
      href={`/users/${user.id}`}
      className="flex items-center gap-3 rounded-2xl border p-4 transition-transform hover:-translate-y-0.5"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
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
  );
}

export function UserConnectionsClient({ mode }: { mode: "following" | "followers" }) {
  const { isLoggedIn, loading } = useCurrentUserProfile();
  const [page, setPage] = useState(0);
  const title = mode === "following" ? "팔로잉" : "팔로워";
  const fetcher = mode === "following" ? fetchMyFollowingPage : fetchMyFollowersPage;

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
          style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 28, color: "var(--foreground)" }}
        >
          {title}
        </h1>

        {!loading && !isLoggedIn ? (
          <ListEmptyState
            title="로그인이 필요해요."
            description="팔로우 목록은 로그인 후 확인할 수 있어요."
            action={
              <Link href="/login" className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
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
            empty={<ListEmptyState title={`${title} 목록이 비어 있어요.`} />}
            renderItems={(users) => (
              <div className="grid gap-3">
                {users.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </div>
            )}
          />
        )}
      </div>
    </PageShell>
  );
}

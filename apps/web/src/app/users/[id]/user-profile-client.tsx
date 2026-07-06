"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { PageShell } from "@/components/page-shell";
import {
  fetchPublicUser,
  followUser,
  unfollowUser,
  type PublicUser,
} from "@/data/users";
import { createConversation } from "@/data/messages";
import { getSessionId } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import { useTheme } from "@/lib/theme-context";
import { UserPostsGrid } from "./user-posts-grid";

export function UserProfileClient({ user: initialUser }: { user: PublicUser }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { sessionId } = useAuthSession();
  const { profile } = useCurrentUserProfile();
  const dark = theme === "dark";
  const [user, setUser] = useState(initialUser);
  const [pending, setPending] = useState(false);
  const [messagePending, setMessagePending] = useState(false);
  const isSelf = profile?.id === user.id;

  const toggleFollow = useCallback(async () => {
    if (!getSessionId()) {
      toast.error("로그인 후 팔로우할 수 있어요.");
      return;
    }
    const nextFollowed = !(user.followedByMe === true);
    setPending(true);
    try {
      if (nextFollowed) await followUser(user.id);
      else await unfollowUser(user.id);
      const refreshed = await fetchPublicUser(user.id);
      setUser(refreshed);
    } catch {
      toast.error("팔로우 상태를 변경하지 못했어요.");
    } finally {
      setPending(false);
    }
  }, [user.followedByMe, user.id]);

  const startMessage = useCallback(async () => {
    if (!getSessionId()) {
      toast.error("로그인 후 메시지를 보낼 수 있어요.");
      return;
    }
    setMessagePending(true);
    try {
      const conv = await createConversation(user.id);
      router.push(`/messages/${conv.id}`);
    } catch {
      toast.error("대화를 시작하지 못했어요.");
    } finally {
      setMessagePending(false);
    }
  }, [router, user.id]);

  return (
    <PageShell paddingClassName="relative min-h-screen overflow-hidden" orb="right">
      <div className="relative pb-20">
        <div className="mx-auto max-w-5xl px-6 pb-8 pt-28 sm:px-8 sm:pt-32">
          <div
            className="rounded-3xl border p-6 sm:p-8"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="shrink-0 shadow-[0_25px_55px_-20px_rgba(0,0,0,0.55)]">
                <Avatar
                  name={user.name}
                  verified={user.verified}
                  size={96}
                  src={user.profileImageUrl ?? undefined}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="mb-2 text-[11px] tracking-[0.28em] uppercase"
                  style={{ color: "var(--accent-secondary)" }}
                >
                  Profile
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h1
                    className="break-words"
                    style={{
                      fontFamily: "'Black Han Sans', sans-serif",
                      fontSize: "clamp(30px, 5vw, 40px)",
                      color: dark ? "#f9f7f2" : "var(--foreground)",
                    }}
                  >
                    {user.name}
                  </h1>
                  {user.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#7dd3a3]/15 px-2.5 py-1 text-[11px] text-[#7dd3a3]">
                      <CheckCircle2 size={12} aria-hidden />
                      인증 사용자
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-[14px]" style={{ color: "var(--foreground-muted)" }}>
                  게시글 {user.postCount.toLocaleString("ko-KR")}개
                  {" · "}
                  {isSelf ? (
                    <>
                      <Link href="/mypage/followers" className="underline underline-offset-2">
                        팔로워 {user.followerCount.toLocaleString("ko-KR")}
                      </Link>
                      {" · "}
                      <Link href="/mypage/following" className="underline underline-offset-2">
                        팔로잉 {user.followingCount.toLocaleString("ko-KR")}
                      </Link>
                    </>
                  ) : (
                    <>
                      팔로워 {user.followerCount.toLocaleString("ko-KR")} · 팔로잉 {user.followingCount.toLocaleString("ko-KR")}
                    </>
                  )}
                </p>
                {!isSelf && sessionId ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={toggleFollow}
                      className="rounded-full px-5 py-2 text-[13px] font-medium disabled:opacity-50"
                      style={{
                        background: user.followedByMe ? "var(--accent-soft)" : "var(--accent)",
                        color: user.followedByMe ? "var(--accent-secondary)" : "#0f1f22",
                      }}
                    >
                      {user.followedByMe ? "팔로잉" : "팔로우"}
                    </button>
                    <button
                      type="button"
                      disabled={messagePending}
                      onClick={() => void startMessage()}
                      className="rounded-full border px-5 py-2 text-[13px] font-medium disabled:opacity-50"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--foreground)",
                        background: "var(--card)",
                      }}
                    >
                      메시지 보내기
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-6 sm:px-8">
          <h2 className="mb-4 text-[18px] font-medium" style={{ color: "var(--foreground)" }}>
            작성한 게시글
          </h2>
          <UserPostsGrid userId={user.id} />
        </div>
      </div>
    </PageShell>
  );
}

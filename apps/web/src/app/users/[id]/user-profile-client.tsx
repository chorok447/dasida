"use client";

import { CheckCircle2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PageShell } from "@/components/page-shell";
import type { PublicUser } from "@/data/users";
import { useTheme } from "@/lib/theme-context";
import { UserPostsGrid } from "./user-posts-grid";

export function UserProfileClient({ user }: { user: PublicUser }) {
  const { theme } = useTheme();
  const dark = theme === "dark";

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
                </p>
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

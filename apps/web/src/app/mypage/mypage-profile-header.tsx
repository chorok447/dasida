"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Monitor, Pencil, PenLine, Plus } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { fetchAccessLogsPage, type AccessLogItem } from "@/data/access-logs";
import type { UserProfile } from "@/data/users";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatAccessTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export function MypageProfileHeader({ profile }: { profile: UserProfile }) {
  const [lastAccess, setLastAccess] = useState<AccessLogItem | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAccessLogsPage(0)
      .then((page) => alive && setLastAccess(page.content[0] ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 pb-8 pt-28 sm:px-8 sm:pt-32">
      <div
        className="rounded-3xl border p-6 sm:p-8"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="shrink-0 shadow-[0_25px_55px_-20px_rgba(0,0,0,0.55)]">
            <Avatar
              name={profile.name}
              verified={profile.verified}
              size={96}
              src={profile.profileImageUrl ?? undefined}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p
              className="mb-2 text-[11px] tracking-[0.28em] uppercase"
              style={{ color: "var(--accent-secondary)" }}
            >
              My Page
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="break-words"
                style={{
                  fontFamily: "var(--font-black-han), sans-serif",
                  fontSize: "clamp(30px, 5vw, 40px)",
                  color: "var(--foreground)",
                }}
              >
                {profile.name}
              </h1>
              {profile.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(var(--accent-rgb),0.15)] px-2.5 py-1 text-[11px] text-[var(--accent)]">
                  <CheckCircle2 size={12} aria-hidden />
                  인증 사용자
                </span>
              ) : (
                <span
                  className="rounded-full px-2.5 py-1 text-[11px]"
                  style={{ background: "var(--badge-muted-bg)", color: "var(--foreground-muted)" }}
                >
                  일반 사용자
                </span>
              )}
            </div>
            <p className="mt-1 break-all text-[14px]" style={{ color: "var(--foreground-muted)" }}>
              {profile.email}
            </p>
            {lastAccess ? (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]" style={{ color: "var(--foreground-muted)" }}>
                <Monitor size={13} aria-hidden />
                <span>
                  최근 접속 {formatAccessTime(lastAccess.accessedAt)} · {lastAccess.os} · {lastAccess.ipAddress}
                </span>
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/posts/new"
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-medium text-[var(--surface-dark)]"
                style={{ background: "var(--accent)" }}
              >
                <PenLine size={13} aria-hidden />
                글쓰기
              </Link>
              <Link
                href="/campaigns/new"
                className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12px]"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                <Plus size={13} aria-hidden />
                캠페인 만들기
              </Link>
              <Link
                href="/profile/edit"
                className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12px]"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                <Pencil size={13} aria-hidden />
                프로필 편집
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

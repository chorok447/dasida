"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Sparkles, TrendingUp } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { FallbackImage } from "@/components/fallback-image";
import { statusMeta, type Campaign } from "@/data/campaigns";
import { fetchRecommendedUsers, followUser, unfollowUser, type PublicUser } from "@/data/users";
import { progressPercent } from "@/lib/progress";
import { useAuthSession } from "@/lib/use-auth-session";

const cardStyle = {
  background: "var(--card)",
  borderColor: "var(--border)",
};

export function FeedSideHot({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div className="rounded-2xl border p-5" style={cardStyle}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={14} style={{ color: "var(--accent)" }} />
        <h3 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 18, color: "var(--foreground)" }}>
          진행 중인 캠페인
        </h3>
      </div>
      <div className="space-y-3">
        {campaigns.map((c) => {
          const pct = progressPercent(c.joined, c.capacity);
          return (
            <div key={c.id} className="flex gap-3 items-center">
              <FallbackImage
                src={c.thumb}
                alt={`${c.title} 캠페인 이미지`}
                thumbnail
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] truncate" style={{ color: "var(--foreground)" }}>
                  {c.title}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(var(--ink-rgb), 0.09)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: statusMeta[c.status].color }} />
                  </div>
                  <span className="text-[11px] opacity-60" style={{ color: "var(--foreground)" }}>{pct}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecommendRow({
  user,
  onToggle,
  pending,
}: {
  user: PublicUser;
  onToggle: (user: PublicUser, nextFollowed: boolean) => void;
  pending: boolean;
}) {
  const followed = user.followedByMe === true;
  return (
    <div className="flex items-center gap-3">
      <Link href={`/users/${user.id}`} className="shrink-0">
        <Avatar name={user.name} verified={user.verified} src={user.profileImageUrl ?? undefined} />
      </Link>
      <Link href={`/users/${user.id}`} className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--foreground)" }}>
        {user.name}
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() => onToggle(user, !followed)}
        className="shrink-0 rounded-full px-3 py-1 text-[12px] disabled:opacity-50"
        style={{
          background: followed ? "var(--accent-soft)" : "var(--accent)",
          color: followed ? "var(--accent-secondary)" : "#0f1f22",
        }}
      >
        {followed ? "팔로잉" : "팔로우"}
      </button>
    </div>
  );
}

export function FeedSideRecommend() {
  const { sessionId } = useAuthSession();
  const [items, setItems] = useState<PublicUser[]>([]);
  const [pendingId, setPendingId] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetchRecommendedUsers(4)
      .then((res) => setItems(res.items))
      .catch(() => setItems([]));
  }, [sessionId]);

  const toggleFollow = useCallback(async (user: PublicUser, nextFollowed: boolean) => {
    setPendingId(user.id);
    try {
      if (nextFollowed) await followUser(user.id);
      else await unfollowUser(user.id);
      setItems((prev) =>
        prev.map((row) => (row.id === user.id ? { ...row, followedByMe: nextFollowed } : row)),
      );
    } finally {
      setPendingId(null);
    }
  }, []);

  if (!sessionId || items.length === 0) return null;

  return (
    <div className="rounded-2xl border p-5" style={cardStyle}>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles size={14} style={{ color: "var(--accent)" }} />
        <h3 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 18, color: "var(--foreground)" }}>
          이런 분 어때요
        </h3>
      </div>
      <div className="space-y-3">
        {items.map((user) => (
          <RecommendRow
            key={user.id}
            user={user}
            onToggle={toggleFollow}
            pending={pendingId === user.id}
          />
        ))}
      </div>
    </div>
  );
}

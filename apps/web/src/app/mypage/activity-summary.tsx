"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme-context";
import { CountUp, StaggerItem } from "@/components/scroll-reveal";
import { fetchBookmarkedPostsPage, fetchMyPostsPage } from "@/data/posts";
import {
  fetchBookmarkedCampaignsPage,
  fetchJoinedCampaignsPage,
  fetchMyCampaignsPage,
} from "@/data/campaigns";

import type { MypageTab } from "./mypage-types";

type SummaryTab = Extract<MypageTab, "posts" | "campaigns" | "created" | "saved">;

type Counts = Record<SummaryTab, number>;

const TILES: { tab: SummaryTab; label: string }[] = [
  { tab: "posts", label: "내 게시글" },
  { tab: "campaigns", label: "참여 캠페인" },
  { tab: "created", label: "개설 캠페인" },
  { tab: "saved", label: "저장함" },
];

// 프로필 아래 활동 요약 KPI. 각 탭 fetcher의 totalElements만 사용(추가 API 없음).
export function ActivitySummary({ onSelectTab }: { onSelectTab: (tab: SummaryTab) => void }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchMyPostsPage(0),
      fetchJoinedCampaignsPage(0),
      fetchMyCampaignsPage(0),
      fetchBookmarkedPostsPage(0),
      fetchBookmarkedCampaignsPage(0),
    ])
      .then(([posts, joined, created, savedPosts, savedCampaigns]) => {
        if (!alive) return;
        setCounts({
          posts: posts.totalElements,
          campaigns: joined.totalElements,
          created: created.totalElements,
          saved: savedPosts.totalElements + savedCampaigns.totalElements,
        });
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  // ponytail: 요약은 부가 정보 — 실패 시 조용히 숨기고 탭 목록이 본 역할을 한다.
  if (failed) return null;

  const bone = dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)";

  return (
    <div className="mx-auto max-w-5xl px-6 sm:px-8">
      <p className="mb-3 text-[11px] tracking-[0.24em] uppercase" style={{ color: "var(--foreground-muted)" }}>
        활동 요약
      </p>
      <div className="grid grid-cols-2 gap-3 pb-8 sm:grid-cols-4">
      {TILES.map(({ tab, label }, i) => (
        <StaggerItem key={tab} index={i}>
          <button
            type="button"
            onClick={() => onSelectTab(tab)}
            aria-label={counts ? `${label} ${counts[tab]}개 보기` : `${label} 보기`}
            className="w-full rounded-2xl border p-5 text-left transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none"
            style={{
              background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
              borderColor: bone,
            }}
          >
            {counts ? (
              <p
                style={{
                  fontFamily: "'Black Han Sans', sans-serif",
                  fontSize: "clamp(26px, 3vw, 34px)",
                  color: "#7dd3a3",
                  lineHeight: 1.1,
                }}
              >
                <CountUp to={counts[tab]} />
              </p>
            ) : (
              <div className="h-8 w-14 animate-pulse rounded-full" style={{ background: bone }} />
            )}
            <p className="mt-2 text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>
              {label}
            </p>
          </button>
        </StaggerItem>
      ))}
      </div>
    </div>
  );
}

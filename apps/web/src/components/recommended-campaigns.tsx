"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { FallbackImage } from "@/components/fallback-image";
import { apiGet } from "@/lib/api";
import { progressPercent } from "@/lib/progress";
import { statusMeta, type Campaign, type CampaignSearchResponse } from "@/data/campaigns";

// 피드와 동일한 추천 기준: 모집 중 + 참여 가능 + 인기순 상위 3개.
const RECOMMEND_QUERY = "/api/campaigns/search?status=open&availableOnly=true&sort=popular&page=0&size=3";

/**
 * empty state 아래에 붙이는 추천 캠페인 카드.
 * 부가 정보라서 로딩·실패·결과 없음일 때는 아무것도 렌더링하지 않는다.
 */
export function RecommendedCampaigns({ heading = "지금 모집 중인 캠페인" }: { heading?: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiGet<CampaignSearchResponse>(RECOMMEND_QUERY)
      .then((response) => {
        if (!cancelled) setCampaigns(response.content);
      })
      .catch(() => {
        // ponytail: 추천 실패는 조용히 무시 — 기존 empty state가 그대로 남는다
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (campaigns.length === 0) return null;

  return (
    <section
      aria-label={heading}
      className="rounded-2xl border p-5"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} style={{ color: "var(--accent)" }} aria-hidden />
          <h3 className="text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
            {heading}
          </h3>
        </div>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1 text-[12px] opacity-70 transition-opacity hover:opacity-100"
          style={{ color: "var(--accent-secondary)" }}
        >
          전체 보기 <ArrowRight size={12} aria-hidden />
        </Link>
      </div>
      <ul className="space-y-3">
        {campaigns.map((campaign) => {
          const pct = progressPercent(campaign.joined, campaign.capacity);
          return (
            <li key={campaign.id}>
              <Link href={`/campaigns/${campaign.id}`} className="group flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                  <FallbackImage
                    src={campaign.thumb}
                    alt=""
                    decorative
                    thumbnail
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-[13px] group-hover:underline"
                    style={{ color: "var(--foreground)" }}
                  >
                    {campaign.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className="h-1 flex-1 rounded-full"
                      style={{ background: "rgba(var(--ink-rgb), 0.09)" }}
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: statusMeta[campaign.status].color }}
                      />
                    </div>
                    <span className="text-[11px] opacity-60" style={{ color: "var(--foreground)" }}>
                      {campaign.joined}/{campaign.capacity}명 · {campaign.daysLeftLabel}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

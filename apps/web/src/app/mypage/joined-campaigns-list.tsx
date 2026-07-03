"use client";

import { StaggerItem } from "@/components/scroll-reveal";
import Link from "next/link";
import { motion } from "motion/react";
import { CalendarDays, Users } from "lucide-react";
import { StatePanel } from "@/components/ui/state-panel";
import { FallbackImage } from "@/components/fallback-image";
import { useTheme } from "@/lib/theme-context";
import { progressPercent } from "@/lib/progress";
import {
  campaignRecruitMeta,
  fetchJoinedCampaignsPage,
  fetchMyCampaignsPage,
  type Campaign,
} from "@/data/campaigns";
import { PaginatedSection } from "./paginated-section";

export type CampaignListMode = "joined" | "created";

const LIST_META: Record<
  CampaignListMode,
  { loading: string; error: string; empty: string; ctaHref: string; ctaLabel: string }
> = {
  joined: {
    loading: "참여 캠페인을 불러오는 중입니다.",
    error: "참여 캠페인을 불러오지 못했습니다.",
    empty: "참여한 캠페인이 없습니다.",
    ctaHref: "/campaigns",
    ctaLabel: "캠페인 둘러보기",
  },
  created: {
    loading: "개설 캠페인을 불러오는 중입니다.",
    error: "개설 캠페인을 불러오지 못했습니다.",
    empty: "개설한 캠페인이 없습니다.",
    ctaHref: "/campaigns/new",
    ctaLabel: "캠페인 개설하기",
  },
};

function StatusBadge({ campaign }: { campaign: Campaign }) {
  const m = campaignRecruitMeta(campaign);
  return (
    <span className="text-[11px] tracking-[0.2em] px-2.5 py-1 rounded-full" style={{ background: m.color, color: m.fg }}>
      {m.label}
    </span>
  );
}

function ProgressBar({ campaign }: { campaign: Campaign }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const pct = progressPercent(campaign.joined, campaign.capacity);
  const meta = campaignRecruitMeta(campaign);
  return (
    <div className="w-full">
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.08)" }}>
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: meta.color }}
        />
      </div>
      <div className="flex justify-between text-[11px] mt-1.5" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
        <span>
          {campaign.capacity > 0 ? (
            <>
              <b style={{ color: meta.color }}>{campaign.joined}</b> / {campaign.capacity}명
            </>
          ) : (
            "모집 인원 미정"
          )}
        </span>
        <span>{meta.label}</span>
      </div>
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="block overflow-hidden rounded-2xl border shadow-[0_20px_45px_-25px_rgba(0,0,0,0.45)] transition-transform hover:-translate-y-1"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <FallbackImage
          src={campaign.thumb}
          alt={`${campaign.title} 캠페인 이미지`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1f22]/70 via-transparent to-transparent" />
        <div className="absolute top-3 right-3">
          <StatusBadge campaign={campaign} />
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 text-white/90 text-[12px]">
          <CalendarDays size={12} />
          <span className="truncate">
            {campaign.status === "open" || campaign.status === "upcoming"
              ? `${campaign.recruitStart} ~ ${campaign.recruitEnd}`
              : `${campaign.runStart} ~ ${campaign.runEnd}`}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <h3
          className="line-clamp-2"
          style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 20, color: dark ? "#f9f7f2" : "#0f1f22", lineHeight: 1.3 }}
        >
          {campaign.title}
        </h3>
        <p className="text-[13px] line-clamp-2" style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>
          {campaign.summary}
        </p>
        <ProgressBar campaign={campaign} />
        <div className="flex items-center justify-between text-[12px] pt-1" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
          <span className="flex items-center gap-1.5">
            <Users size={12} /> 모집 {campaign.capacity}명
          </span>
          <span>{campaign.daysLeftLabel}</span>
        </div>
      </div>
    </Link>
  );
}

export function UserCampaignsList({
  mode,
  page,
  onPageChange,
}: {
  mode: CampaignListMode;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const meta = LIST_META[mode];
  return (
    <PaginatedSection<Campaign>
      identityKey={mode}
      page={page}
      onPageChange={onPageChange}
      fetcher={mode === "joined" ? fetchJoinedCampaignsPage : fetchMyCampaignsPage}
      loadingLabel={meta.loading}
      errorLabel={meta.error}
      empty={
        <StatePanel className="min-h-64 rounded-2xl">
          <CalendarDays size={28} className="text-[#7dd3a3]" />
          <p>{meta.empty}</p>
          <Link href={meta.ctaHref} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
            {meta.ctaLabel}
          </Link>
        </StatePanel>
      }
      renderItems={(campaigns) => (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign, i) => (
            <StaggerItem key={campaign.id} index={i}>
              <CampaignCard campaign={campaign} />
            </StaggerItem>
          ))}
        </div>
      )}
    />
  );
}

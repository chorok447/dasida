"use client";

import { StaggerItem } from "@/components/scroll-reveal";
import Link from "next/link";
import { motion } from "motion/react";
import { CalendarDays, ExternalLink, Loader2, PenLine, Users, UserMinus, EyeOff } from "lucide-react";
import { useState } from "react";
import { ListEmptyState } from "@/components/list-empty-state";
import { FallbackImage } from "@/components/fallback-image";
import { RecommendedCampaigns } from "@/components/recommended-campaigns";
import { apiDelete, ApiError } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
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
  { loading: string; error: string; emptyTitle: string; ctaHref: string; ctaLabel: string }
> = {
  joined: {
    loading: "참여 캠페인을 불러오는 중입니다.",
    error: "참여 캠페인을 불러오지 못했습니다.",
    emptyTitle: "참여한 캠페인이 없어요.",
    ctaHref: "/campaigns",
    ctaLabel: "캠페인 둘러보기",
  },
  created: {
    loading: "개설 캠페인을 불러오는 중입니다.",
    error: "개설 캠페인을 불러오지 못했습니다.",
    emptyTitle: "개설한 캠페인이 없어요.",
    ctaHref: "/campaigns/new",
    ctaLabel: "캠페인 만들기",
  },
};

function cardActionClass(dark: boolean) {
  return `inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] transition-colors ${
    dark
      ? "border border-white/12 bg-white/5 text-white/85 hover:bg-white/10"
      : "border border-[rgba(28,64,68,0.12)] bg-white text-[#1c4044] hover:bg-[rgba(28,64,68,0.04)]"
  }`;
}

function StatusBadge({ campaign }: { campaign: Campaign }) {
  const m = campaignRecruitMeta(campaign);
  return (
    <span className="rounded-full px-2.5 py-1 text-[11px] tracking-[0.2em]" style={{ background: m.color, color: m.fg }}>
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
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.08)" }}>
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: meta.color }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px]" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
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

function CampaignCard({
  campaign,
  mode,
  leaving,
  onLeave,
}: {
  campaign: Campaign;
  mode: CampaignListMode;
  leaving: boolean;
  onLeave?: (campaignId: string) => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <article
      className="overflow-hidden rounded-2xl border shadow-[0_20px_45px_-25px_rgba(0,0,0,0.45)]"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <Link href={`/campaigns/${campaign.id}`} className="block transition-transform hover:-translate-y-0.5">
        <div className="relative aspect-[4/3] overflow-hidden">
          <FallbackImage
            src={campaign.thumb}
            alt={`${campaign.title} 캠페인 이미지`}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f1f22]/70 via-transparent to-transparent" />
          <div className="absolute right-3 top-3">
            <StatusBadge campaign={campaign} />
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 text-[12px] text-white/90">
            <CalendarDays size={12} aria-hidden />
            <span className="truncate">
              {campaign.status === "open" || campaign.status === "upcoming"
                ? `${campaign.recruitStart} ~ ${campaign.recruitEnd}`
                : `${campaign.runStart} ~ ${campaign.runEnd}`}
            </span>
          </div>
        </div>

        <div className="space-y-3 p-5">
          {campaign.hidden ? (
            <p
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
              style={{ background: "rgba(237,92,72,0.14)", color: "#ed5c48" }}
            >
              <EyeOff size={12} aria-hidden /> 운영 정책에 따라 숨김 처리된 캠페인입니다
            </p>
          ) : null}
          <h3
            className="line-clamp-2"
            style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 20, color: "var(--foreground)", lineHeight: 1.3 }}
          >
            {campaign.title}
          </h3>
          <p className="line-clamp-2 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
            {campaign.summary}
          </p>
          <ProgressBar campaign={campaign} />
          <div className="flex items-center justify-between pt-1 text-[12px]" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
            <span className="flex items-center gap-1.5">
              <Users size={12} aria-hidden /> 모집 {campaign.capacity}명
            </span>
            <span>{campaign.daysLeftLabel}</span>
          </div>
        </div>
      </Link>

      <div className="flex flex-wrap gap-2 border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <Link href={`/campaigns/${campaign.id}`} className={cardActionClass(dark)}>
          <ExternalLink size={12} aria-hidden /> 상세 보기
        </Link>
        {mode === "created" && campaign.ownedByMe ? (
          <Link href={`/campaigns/${campaign.id}/edit`} className={cardActionClass(dark)}>
            <PenLine size={12} aria-hidden /> 편집
          </Link>
        ) : null}
        {mode === "joined" && campaign.joinedByMe && onLeave ? (
          <button
            type="button"
            onClick={() => onLeave(campaign.id)}
            disabled={leaving}
            aria-busy={leaving || undefined}
            aria-label={leaving ? "참여 취소 처리 중" : "참여 취소"}
            className={`${cardActionClass(dark)} disabled:cursor-wait disabled:opacity-50`}
          >
            {leaving ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <UserMinus size={12} aria-hidden />}
            {leaving ? "취소 중…" : "참여 취소"}
          </button>
        ) : null}
      </div>
    </article>
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
  const { theme } = useTheme();
  const dark = theme === "dark";
  const meta = LIST_META[mode];
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const leaveCampaign = async (campaignId: string, reload: () => void) => {
    if (leavingId) return;
    const requestToken = getSessionId();
    if (!requestToken) {
      clearSession();
      return;
    }
    setLeavingId(campaignId);
    setActionError("");
    try {
      await apiDelete<Campaign>(`/api/campaigns/${campaignId}/join`);
      if (getSessionId() !== requestToken) return;
      reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        return;
      }
      setActionError("참여 취소에 실패했습니다.");
    } finally {
      setLeavingId(null);
    }
  };

  return (
    <PaginatedSection<Campaign>
      identityKey={mode}
      page={page}
      onPageChange={onPageChange}
      fetcher={mode === "joined" ? fetchJoinedCampaignsPage : fetchMyCampaignsPage}
      loadingLabel={meta.loading}
      errorLabel={meta.error}
      empty={
        <div className="space-y-4">
          <ListEmptyState
            title={meta.emptyTitle}
            action={
              <Link href={meta.ctaHref} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] font-medium text-[#0f1f22]">
                {meta.ctaLabel}
              </Link>
            }
          />
          {mode === "joined" ? <RecommendedCampaigns /> : null}
        </div>
      }
      renderItems={(campaigns, reload) => (
        <div className="space-y-4">
          {actionError ? (
            <div
              className="rounded-xl px-4 py-3 text-[13px]"
              role="alert"
              style={{ background: "rgba(237,92,72,0.12)", color: dark ? "#f3b4ab" : "#b3402f" }}
            >
              {actionError}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign, i) => (
              <StaggerItem key={campaign.id} index={i}>
                <CampaignCard
                  campaign={campaign}
                  mode={mode}
                  leaving={leavingId === campaign.id}
                  onLeave={mode === "joined" ? (id) => leaveCampaign(id, reload) : undefined}
                />
              </StaggerItem>
            ))}
          </div>
        </div>
      )}
    />
  );
}

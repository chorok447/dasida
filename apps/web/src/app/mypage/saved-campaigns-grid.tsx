"use client";

import { StaggerItem } from "@/components/scroll-reveal";
import Link from "next/link";
import { useState } from "react";
import { Bookmark, CalendarDays, ExternalLink, Users } from "lucide-react";
import { ApiError } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
import { progressPercent } from "@/lib/progress";
import {
  campaignRecruitMeta,
  fetchBookmarkedCampaignsPage,
  unbookmarkCampaign,
  type Campaign,
} from "@/data/campaigns";
import { FallbackImage } from "@/components/fallback-image";
import { ListEmptyState } from "@/components/list-empty-state";
import { PaginatedSection } from "./paginated-section";

// 카드 하단 액션 버튼 공통 클래스. 색은 CSS 토큰이 테마를 처리한다.
const cardActionClass =
  "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] transition-colors border-[rgba(var(--ink-rgb),0.12)] bg-[color:var(--glass-strong)] text-[color:var(--heading)] hover:bg-[color:var(--chip-bg)]";

function SavedCampaignCard({
  campaign,
  removing,
  onRemove,
}: {
  campaign: Campaign;
  removing: boolean;
  onRemove: (campaignId: string) => void;
}) {
  const meta = campaignRecruitMeta(campaign);
  const pct = progressPercent(campaign.joined, campaign.capacity);

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
            thumbnail
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f1f22]/70 via-transparent to-transparent" />
          <div className="absolute right-3 top-3">
            <span className="rounded-full px-2.5 py-1 text-[11px] tracking-[0.2em]" style={{ background: meta.color, color: meta.fg }}>
              {meta.label}
            </span>
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

        <div className="space-y-3 p-5" style={{ color: "var(--foreground)" }}>
          <h3 className="line-clamp-2" style={{ fontFamily: "var(--font-black-han), sans-serif", fontSize: 20, lineHeight: 1.3 }}>
            {campaign.title}
          </h3>
          <p className="line-clamp-2 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
            {campaign.summary}
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(var(--ink-rgb), 0.09)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
          </div>
          <div className="flex items-center justify-between text-[12px]" style={{ color: "rgba(var(--ink-rgb), 0.6)" }}>
            <span className="flex items-center gap-1.5">
              <Users size={12} aria-hidden /> {campaign.joined} / {campaign.capacity}명
            </span>
            <span>{campaign.daysLeftLabel}</span>
          </div>
        </div>
      </Link>

      <div className="flex flex-wrap gap-2 border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <Link href={`/campaigns/${campaign.id}`} className={cardActionClass}>
          <ExternalLink size={12} aria-hidden /> 상세 보기
        </Link>
        <button
          type="button"
          onClick={() => onRemove(campaign.id)}
          disabled={removing}
          aria-busy={removing || undefined}
          aria-label={removing ? "북마크 해제 중" : "북마크 해제"}
          className={`${cardActionClass} disabled:cursor-wait disabled:opacity-50`}
        >
          <Bookmark size={12} fill="currentColor" aria-hidden /> 저장 해제
        </button>
      </div>
    </article>
  );
}

export function SavedCampaignsGrid({ page, onPageChange }: { page: number; onPageChange: (page: number) => void }) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const removeBookmark = async (campaignId: string, reload: () => void) => {
    if (removingId) return;
    const requestToken = getSessionId();
    if (!requestToken) {
      clearSession();
      return;
    }
    setRemovingId(campaignId);
    setActionError("");
    try {
      await unbookmarkCampaign(campaignId);
      if (getSessionId() !== requestToken) return;
      reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        return;
      }
      setActionError("북마크 해제에 실패했습니다.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <PaginatedSection<Campaign>
      identityKey="saved-campaigns"
      page={page}
      onPageChange={onPageChange}
      fetcher={fetchBookmarkedCampaignsPage}
      loadingLabel="저장한 캠페인을 불러오는 중입니다."
      errorLabel="저장한 캠페인을 불러오지 못했습니다."
      empty={
        <ListEmptyState
          title="저장한 캠페인이 없어요."
          action={
            <Link href="/campaigns" className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] font-medium text-[#0f1f22]">
              캠페인 둘러보기
            </Link>
          }
        />
      }
      renderItems={(campaigns, reload) => (
        <div className="space-y-4">
          {actionError ? (
            <div
              className="rounded-xl px-4 py-3 text-[13px]"
              role="alert"
              style={{ background: "rgba(237,92,72,0.12)", color: "var(--danger)" }}
            >
              {actionError}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign, i) => (
              <StaggerItem key={campaign.id} index={i}>
                <SavedCampaignCard
                  campaign={campaign}
                  removing={removingId === campaign.id}
                  onRemove={(id) => removeBookmark(id, reload)}
                />
              </StaggerItem>
            ))}
          </div>
        </div>
      )}
    />
  );
}

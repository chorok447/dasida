"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Pencil, Trash2, Users, Bookmark } from "lucide-react";
import { progressPercent } from "@/lib/progress";
import { campaignRecruitMeta, type Campaign } from "@/data/campaigns";
import { Avatar } from "@/components/avatar";
import { FallbackImage } from "@/components/fallback-image";
import { ReportButton } from "@/components/report-button";
import { AdminModerationButton } from "@/components/admin-moderation-button";
import { ShareButton } from "@/components/share-button";

function StatusBadge({ c }: { c: Campaign }) {
  const m = campaignRecruitMeta(c);
  return (
    <span
      className="text-[11px] tracking-[0.2em] px-3 py-1.5 rounded-full inline-block"
      style={{ background: m.color, color: m.fg }}
    >
      {m.label}
    </span>
  );
}

export function CampaignHeaderCard({
  c,
  bookmarked,
  bookmarking,
  onBookmark,
  bookmarkDisabled,
}: {
  c: Campaign;
  bookmarked?: boolean;
  bookmarking?: boolean;
  onBookmark?: () => void;
  bookmarkDisabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 150, damping: 22 });
  const sy = useSpring(my, { stiffness: 150, damping: 22 });
  const rY = useTransform(sx, [-0.5, 0.5], [-6, 6]);
  const rX = useTransform(sy, [-0.5, 0.5], [5, -5]);
  const pct = progressPercent(c.joined, c.capacity);

  return (
    <div style={{ perspective: 1600 }}>
      <motion.div
        ref={ref}
        onMouseMove={(e) => {
          const r = ref.current?.getBoundingClientRect();
          if (!r) return;
          mx.set((e.clientX - r.left) / r.width - 0.5);
          my.set((e.clientY - r.top) / r.height - 0.5);
        }}
        onMouseLeave={() => {
          mx.set(0);
          my.set(0);
        }}
        style={{
          rotateX: rX,
          rotateY: rY,
          transformStyle: "preserve-3d",
          background: "var(--card)",
          borderColor: "var(--border)",
        }}
        className="rounded-3xl border overflow-hidden shadow-[0_40px_80px_-30px_rgba(0,0,0,0.4)]"
      >
        <div className="grid grid-cols-1 md:grid-cols-[400px_1fr]">
          <div className="relative aspect-square md:aspect-auto overflow-hidden">
            <FallbackImage src={c.thumb} alt={`${c.title} 캠페인 이미지`} className="w-full h-full object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-tr from-[#0f1f22]/40 to-transparent" />
            <div className="absolute top-4 left-4 flex items-center gap-2" style={{ transform: "translateZ(50px)" }}>
              <StatusBadge c={c} />
              {c.ownedByMe ? (
                <span className="rounded-full bg-[#0f1f22]/80 px-3 py-1.5 text-[11px] text-[var(--accent)]">
                  내가 개설
                </span>
              ) : null}
            </div>
          </div>
          <div className="p-8 flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <h1
                style={{
                  fontFamily: "var(--font-black-han), sans-serif",
                  fontSize: "clamp(28px, 3vw, 40px)",
                  color: "var(--foreground)",
                  lineHeight: 1.2,
                }}
              >
                {c.title}
              </h1>
              <div className="flex gap-2 flex-shrink-0">
                {onBookmark ? (
                  <button
                    type="button"
                    onClick={onBookmark}
                    disabled={bookmarkDisabled || bookmarking}
                    aria-label={bookmarked ? "북마크 해제" : "북마크 추가"}
                    className="flex h-9 w-9 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-45"
                    style={{
                      background: bookmarked ? "var(--accent)" : "var(--border)",
                      color: bookmarked ? "#0f1f22" : "var(--foreground)",
                    }}
                  >
                    <Bookmark size={14} fill={bookmarked ? "#0f1f22" : "transparent"} />
                  </button>
                ) : null}
                <AdminModerationButton targetType="CAMPAIGN" targetId={c.id} />
                <ReportButton targetType="CAMPAIGN" targetId={c.id} ownedByMe={c.ownedByMe} className="!h-9 !px-3" />
                <ShareButton
                  title={c.title}
                  text={c.summary}
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: "var(--border)", color: "var(--foreground)" }}
                />
              </div>
            </div>

            <p className="text-[14px]" style={{ color: "var(--foreground-muted)" }}>
              {c.summary}
            </p>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]" style={{ color: "var(--foreground)" }}>
              <div>
                <div className="opacity-60 mb-0.5">모집 기간</div>
                <div>{c.recruitStart} ~ {c.recruitEnd}</div>
              </div>
              <div>
                <div className="opacity-60 mb-0.5">진행 기간</div>
                <div>{c.runStart} ~ {c.runEnd}</div>
              </div>
              <div>
                <div className="opacity-60 mb-0.5">모집 인원</div>
                <div>{c.capacity}명</div>
              </div>
              <div>
                <div className="opacity-60 mb-0.5">현재</div>
                <div>{c.joined}명 참여 중</div>
              </div>
            </div>

            <div>
              <div
                className="h-2 w-full rounded-full overflow-hidden"
                style={{ background: "var(--border)" }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: campaignRecruitMeta(c).color }}
                />
              </div>
              <div className="flex justify-between text-[12px] mt-2" style={{ color: "var(--foreground-muted)" }}>
                <span>{Math.round(pct)}% 달성</span>
                <span>{c.daysLeftLabel}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <Avatar name={c.author.name} verified={c.author.verified} src={c.author.profileImageUrl ?? undefined} />
              <span style={{ color: "var(--foreground)" }}>{c.author.name}</span>
              <span className="text-[12px] opacity-60" style={{ color: "var(--foreground)" }}>· 캠페인 주최자</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function CampaignStatusManagement({
  c,
  ownershipConfirmed,
  updating,
  deleting,
  disabled,
  onChange,
  onDelete,
}: {
  c: Campaign;
  ownershipConfirmed: boolean;
  updating: boolean;
  deleting: boolean;
  disabled: boolean;
  onChange: (status: "open" | "closed") => void;
  onDelete: () => void;
}) {
  if (!ownershipConfirmed) return null;

  const target = c.status === "upcoming" ? "open" : c.status === "open" ? "closed" : null;
  const label = target === "open" ? "모집 시작" : target === "closed" ? "모집 마감" : "모집 마감됨";

  return (
    <div
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        color: "var(--foreground)",
      }}
    >
      <div>
        <p className="text-[13px] font-medium">모집 상태 관리</p>
        <p className="mt-0.5 text-[12px] opacity-60">캠페인 개설자만 모집을 시작하거나 마감할 수 있습니다.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/campaigns/${c.id}/participants`}
          aria-label="참가자 관리"
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : undefined}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-medium ${
            disabled ? "pointer-events-none opacity-45" : ""
          }`}
          style={{
            background: "var(--border)",
            color: "var(--foreground)",
          }}
        >
          <Users size={14} /> 참가자 관리
        </Link>
        {c.status === "upcoming" ? (
          <Link
            href={`/campaigns/${c.id}/edit`}
            aria-label="캠페인 수정"
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-medium ${
              disabled ? "pointer-events-none opacity-45" : ""
            }`}
            style={{
              background: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <Pencil size={14} /> 캠페인 수정
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => target && onChange(target)}
          disabled={disabled || target === null}
          aria-label={label}
          className="rounded-full px-5 py-2 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-45"
          style={{
            background: target === "closed" ? "var(--danger-soft)" : "var(--accent)",
            color: target === "closed" ? "var(--danger)" : "#0f1f22",
          }}
        >
          {updating ? "처리 중…" : label}
        </button>
        {c.status === "upcoming" ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            aria-label="캠페인 삭제"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-45"
            style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
          >
            <Trash2 size={14} /> {deleting ? "삭제 중…" : "캠페인 삭제"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

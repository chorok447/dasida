"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Calendar, Users } from "lucide-react";
import { ReportButton } from "@/components/report-button";
import { FallbackImage } from "@/components/fallback-image";
import { campaignRecruitMeta, type Campaign } from "@/data/campaigns";
import { progressPercent } from "@/lib/progress";

function StatusBadge({ campaign }: { campaign: Campaign }) {
  const meta = campaignRecruitMeta(campaign);
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px] tracking-[0.2em]"
      style={{ background: meta.color, color: meta.fg }}
    >
      {meta.label}
    </span>
  );
}

function ProgressBar({ campaign }: { campaign: Campaign }) {
  const pct = progressPercent(campaign.joined, campaign.capacity);
  const meta = campaignRecruitMeta(campaign);
  return (
    <div className="w-full">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--border)" }}
      >
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: meta.color }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px]" style={{ color: "var(--foreground-muted)" }}>
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

export function CampaignListCard({ campaign, onOpen }: { campaign: Campaign; onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 200, damping: 22 });
  const springY = useSpring(mouseY, { stiffness: 200, damping: 22 });
  const rotateY = useTransform(springX, [-0.5, 0.5], [-12, 12]);
  const rotateX = useTransform(springY, [-0.5, 0.5], [10, -10]);

  return (
    <div className="relative" style={{ perspective: 1000 }}>
      <ReportButton
        targetType="CAMPAIGN"
        targetId={campaign.id}
        ownedByMe={campaign.ownedByMe}
        className="absolute left-3 top-3 z-20 bg-[var(--surface-dark)]/75 !text-white backdrop-blur-sm"
      />
      <motion.button
        type="button"
        ref={ref}
        onMouseMove={(event) => {
          const rect = ref.current?.getBoundingClientRect();
          if (!rect) return;
          mouseX.set((event.clientX - rect.left) / rect.width - 0.5);
          mouseY.set((event.clientY - rect.top) / rect.height - 0.5);
        }}
        onMouseLeave={() => {
          mouseX.set(0);
          mouseY.set(0);
        }}
        onClick={onOpen}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="w-full cursor-pointer overflow-hidden rounded-2xl border text-left shadow-[0_20px_50px_-25px_rgba(0,0,0,0.5)]"
      >
        <div style={{ background: "var(--card)", borderColor: "var(--border)" }} className="border-0">
          <div className="relative aspect-[4/3] overflow-hidden">
            <FallbackImage
              src={campaign.thumb}
              alt={`${campaign.title} 캠페인 이미지`}
              thumbnail
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-dark)]/70 via-transparent to-transparent" />
            <div className="absolute right-3 top-3" style={{ transform: "translateZ(40px)" }}>
              <StatusBadge campaign={campaign} />
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 text-[12px] text-white/90">
              <Calendar size={12} />
              <span>{campaign.recruitStart} ~ {campaign.recruitEnd}</span>
            </div>
          </div>
          <div className="space-y-3 p-5">
            <h2
              style={{
                fontFamily: "var(--font-black-han), sans-serif",
                fontSize: 22,
                color: "var(--foreground)",
                lineHeight: 1.25,
              }}
            >
              {campaign.title}
            </h2>
            <p className="line-clamp-2 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
              {campaign.summary}
            </p>
            <ProgressBar campaign={campaign} />
            <div className="flex items-center justify-between pt-1 text-[12px]" style={{ color: "var(--foreground-muted)" }}>
              <span className="flex items-center gap-1.5">
                <Users size={12} /> 모집 {campaign.capacity}명
              </span>
              <span>{campaign.daysLeftLabel}</span>
            </div>
          </div>
        </div>
      </motion.button>
    </div>
  );
}

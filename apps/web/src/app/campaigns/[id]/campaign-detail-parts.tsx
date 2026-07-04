"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Pencil, Trash2, Users, Loader2, LogIn, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { progressPercent } from "@/lib/progress";
import { campaignRecruitMeta, type Campaign } from "@/data/campaigns";
import { Avatar } from "@/components/avatar";
import { FallbackImage } from "@/components/fallback-image";
import { ReportButton } from "@/components/report-button";
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

export function CampaignHeaderCard({ c }: { c: Campaign }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
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
          background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
          borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
        }}
        className="rounded-3xl border overflow-hidden shadow-[0_40px_80px_-30px_rgba(0,0,0,0.4)]"
      >
        <div className="grid grid-cols-1 md:grid-cols-[400px_1fr]">
          <div className="relative aspect-square md:aspect-auto overflow-hidden">
            <FallbackImage src={c.thumb} alt={`${c.title} 캠페인 이미지`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-tr from-[#0f1f22]/40 to-transparent" />
            <div className="absolute top-4 left-4 flex items-center gap-2" style={{ transform: "translateZ(50px)" }}>
              <StatusBadge c={c} />
              {c.ownedByMe ? (
                <span className="rounded-full bg-[#0f1f22]/80 px-3 py-1.5 text-[11px] text-[#7dd3a3]">
                  내가 개설
                </span>
              ) : null}
            </div>
          </div>
          <div className="p-8 flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <h1
                style={{
                  fontFamily: "'Black Han Sans', sans-serif",
                  fontSize: "clamp(28px, 3vw, 40px)",
                  color: dark ? "#f9f7f2" : "#0f1f22",
                  lineHeight: 1.2,
                }}
              >
                {c.title}
              </h1>
              <div className="flex gap-2 flex-shrink-0">
                <ReportButton targetType="CAMPAIGN" targetId={c.id} ownedByMe={c.ownedByMe} className="!h-9 !px-3" />
                <ShareButton
                  title={c.title}
                  text={c.summary}
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.06)", color: dark ? "#f9f7f2" : "#1c4044" }}
                />
              </div>
            </div>

            <p className="text-[14px]" style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>
              {c.summary}
            </p>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.8)" : "rgba(28,64,68,0.85)" }}>
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
                style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: campaignRecruitMeta(c).color }}
                />
              </div>
              <div className="flex justify-between text-[12px] mt-2" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
                <span>{Math.round(pct)}% 달성</span>
                <span>{c.daysLeftLabel}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}>
              <Avatar name={c.author.name} verified={c.author.verified} />
              <span style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{c.author.name}</span>
              <span className="text-[12px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>· 캠페인 주최자</span>
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
  const { theme } = useTheme();
  const dark = theme === "dark";
  if (!ownershipConfirmed) return null;

  const target = c.status === "upcoming" ? "open" : c.status === "open" ? "closed" : null;
  const label = target === "open" ? "모집 시작" : target === "closed" ? "모집 마감" : "모집 마감됨";

  return (
    <div
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
        color: dark ? "#f9f7f2" : "#0f1f22",
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
            background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
            color: dark ? "#f9f7f2" : "#1c4044",
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
              background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
              color: dark ? "#f9f7f2" : "#1c4044",
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
            background: target === "closed" ? "rgba(237,92,72,0.16)" : "#7dd3a3",
            color: target === "closed" ? "#ed5c48" : "#0f1f22",
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
            style={{ background: "rgba(237,92,72,0.16)", color: "#ed5c48" }}
          >
            <Trash2 size={14} /> {deleting ? "삭제 중…" : "캠페인 삭제"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CampaignCTABar({
  c,
  onJoin,
  onLeave,
  onLogin,
  action,
  disabled,
  loggedIn,
}: {
  c: Campaign;
  onJoin: () => void;
  onLeave: () => void;
  onLogin: () => void;
  action: "join" | "leave" | null;
  disabled: boolean;
  loggedIn: boolean;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const panelStyle = {
    background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.78)",
    borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)",
    color: dark ? "#f9f7f2" : "#0f1f22",
  };
  const joinedStyle = { background: "rgba(125,211,163,0.18)", color: dark ? "#7dd3a3" : "#1c4044", fontSize: 16 };
  const pending = action !== null;

  if (c.joinedByMe) {
    if (c.status === "open") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-5 px-6 rounded-2xl text-center font-medium"
            style={joinedStyle}
          >
            <CheckCircle2 size={20} aria-hidden />
            <span>참여 완료 · 모집 중인 캠페인입니다</span>
          </div>
          <button
            type="button"
            onClick={onLeave}
            disabled={disabled || pending}
            aria-busy={action === "leave"}
            aria-label={action === "leave" ? "참여 취소 처리 중" : "참여 취소"}
            className="inline-flex items-center justify-center gap-2 py-5 px-6 rounded-2xl font-medium hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "rgba(237,92,72,0.16)", color: "#ed5c48" }}
          >
            {action === "leave" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
            {action === "leave" ? "취소 처리 중…" : "참여 취소"}
          </button>
        </div>
      );
    }
    const joinedMessage =
      c.status === "closed"
        ? "참여 완료 · 모집이 마감된 캠페인입니다"
        : "참여 완료 · 종료된 캠페인입니다";
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 w-full py-5 rounded-2xl text-center font-medium"
        style={joinedStyle}
      >
        <CheckCircle2 size={20} aria-hidden />
        <span>{joinedMessage}</span>
      </div>
    );
  }

  if (c.recruitable) {
    if (!loggedIn) {
      return (
        <div
          className="flex flex-col items-center gap-3 rounded-2xl border px-6 py-6 text-center"
          style={panelStyle}
        >
          <p className="text-[14px]" style={{ color: dark ? "rgba(255,255,255,0.75)" : "rgba(28,64,68,0.75)" }}>
            로그인 후 캠페인에 참여할 수 있어요.
          </p>
          <button
            type="button"
            onClick={onLogin}
            className="inline-flex items-center gap-2 rounded-full bg-[#7dd3a3] px-6 py-2.5 text-[14px] font-medium text-[#0f1f22]"
          >
            <LogIn size={16} aria-hidden />
            로그인하고 참여하기
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={onJoin}
        disabled={disabled || pending}
        aria-busy={action === "join"}
        aria-label={action === "join" ? "캠페인 참여 처리 중" : "캠페인 참여하기"}
        className="inline-flex w-full items-center justify-center gap-2 py-5 rounded-2xl font-medium hover:-translate-y-0.5 transition-transform shadow-[0_30px_60px_-20px_rgba(125,211,163,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "#7dd3a3", color: "#0f1f22", fontSize: 17 }}
      >
        {action === "join" ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
        {action === "join" ? "참여 처리 중…" : "캠페인 참여하기"}
      </button>
    );
  }

  const unavailableMessage =
    c.recruitState === "before_recruit"
      ? "모집 시작 전이라 참여할 수 없습니다"
      : c.recruitState === "ended"
        ? "종료된 캠페인이라 참여할 수 없습니다"
        : c.recruitState === "closed"
          ? "모집이 마감되어 참여할 수 없습니다"
          : "정원이 마감되어 참여할 수 없습니다";

  return (
    <div
      role="status"
      className="w-full rounded-2xl border px-6 py-5 text-center"
      style={{
        ...panelStyle,
        color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)",
      }}
    >
      <p className="text-[15px] font-medium">{unavailableMessage}</p>
      <p className="mt-1 text-[12px] opacity-70">현재 이 캠페인은 새 참여를 받지 않습니다.</p>
    </div>
  );
}

export function CampaignContentTab({ c }: { c: Campaign }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div
      className="rounded-3xl border p-10 space-y-8"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <h2 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 26, color: dark ? "#f9f7f2" : "#0f1f22" }}>
        {c.body.heading}
      </h2>
      {c.body.paragraphs.map((p, i) => (
        <p key={i} style={{ color: dark ? "rgba(255,255,255,0.75)" : "rgba(28,64,68,0.8)", lineHeight: 1.8 }}>
          {p}
        </p>
      ))}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {c.body.images.map((src, i) => (
          <div key={i} className="aspect-[4/3] rounded-2xl overflow-hidden">
            <FallbackImage src={src} alt={`캠페인 상세 이미지 ${i + 1}`} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

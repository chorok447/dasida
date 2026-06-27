"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { CalendarDays, RefreshCw, Users } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { useTheme } from "@/lib/theme-context";
import { progressPercent } from "@/lib/progress";
import { statusMeta, type Campaign, type CampaignStatus } from "@/data/campaigns";

type LoadStatus = "idle" | "loading" | "success" | "error";

type ListState = {
  identity: string | null;
  status: LoadStatus;
  campaigns: Campaign[];
  error: string;
};

function StatePanel({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div
      className="min-h-64 rounded-2xl border flex flex-col items-center justify-center gap-4 px-6 text-center"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
        color: dark ? "#f9f7f2" : "#0f1f22",
      }}
    >
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const m = statusMeta[status];
  return (
    <span
      className="text-[11px] tracking-[0.2em] px-2.5 py-1 rounded-full"
      style={{ background: m.color, color: m.fg }}
    >
      {m.label}
    </span>
  );
}

function ProgressBar({ joined, capacity, status }: { joined: number; capacity: number; status: CampaignStatus }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const pct = progressPercent(joined, capacity);
  return (
    <div className="w-full">
      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.08)" }}
      >
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: statusMeta[status].color }}
        />
      </div>
      <div
        className="flex justify-between text-[11px] mt-1.5"
        style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}
      >
        <span>
          {capacity > 0 ? (
            <>
              <b style={{ color: statusMeta[status].color }}>{joined}</b> / {capacity}명
            </>
          ) : (
            "모집 인원 미정"
          )}
        </span>
        <span>{statusMeta[status].label === "모집중" ? "참여 중" : statusMeta[status].label}</span>
      </div>
    </div>
  );
}

function JoinedCampaignCard({ campaign }: { campaign: Campaign }) {
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
        <img src={campaign.thumb} alt={campaign.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1f22]/70 via-transparent to-transparent" />
        <div className="absolute top-3 right-3">
          <StatusBadge status={campaign.status} />
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
          style={{
            fontFamily: "'Black Han Sans', sans-serif",
            fontSize: 20,
            color: dark ? "#f9f7f2" : "#0f1f22",
            lineHeight: 1.3,
          }}
        >
          {campaign.title}
        </h3>
        <p
          className="text-[13px] line-clamp-2"
          style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}
        >
          {campaign.summary}
        </p>
        <ProgressBar joined={campaign.joined} capacity={campaign.capacity} status={campaign.status} />
        <div
          className="flex items-center justify-between text-[12px] pt-1"
          style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}
        >
          <span className="flex items-center gap-1.5">
            <Users size={12} /> 모집 {campaign.capacity}명
          </span>
          <span>{campaign.daysLeftLabel}</span>
        </div>
      </div>
    </Link>
  );
}

export function JoinedCampaignsList() {
  const { token } = useAuthSession();
  const [reloadTick, setReloadTick] = useState(0);
  const [state, setState] = useState<ListState>(() => ({
    identity: token,
    status: token ? "loading" : "idle",
    campaigns: [],
    error: "",
  }));
  const generationRef = useRef(0);

  // token 교체 시 이전 사용자 목록을 네트워크 응답보다 먼저 제거
  if (state.identity !== token) {
    setState({
      identity: token,
      status: token ? "loading" : "idle",
      campaigns: [],
      error: "",
    });
  }

  useEffect(() => {
    if (!token) return;

    const requestToken = token;
    const generation = ++generationRef.current;
    let cancelled = false;
    const isCurrent = () =>
      !cancelled && generation === generationRef.current && getToken() === requestToken;

    apiGet<Campaign[]>("/api/campaigns/joined")
      .then((campaigns) => {
        if (!isCurrent()) return;
        setState((current) =>
          current.identity === requestToken
            ? { ...current, status: "success", campaigns, error: "" }
            : current,
        );
      })
      .catch((error) => {
        if (!isCurrent()) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          return;
        }
        setState((current) =>
          current.identity === requestToken
            ? {
                ...current,
                status: "error",
                campaigns: [],
                error: "참여 캠페인을 불러오지 못했습니다.",
              }
            : current,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [reloadTick, token]);

  const retry = () => {
    setState((current) => ({ ...current, status: "loading", error: "" }));
    setReloadTick((tick) => tick + 1);
  };

  if (state.status === "loading") {
    return (
      <StatePanel>
        <RefreshCw size={26} className="animate-spin text-[#7dd3a3]" />
        <p>참여 캠페인을 불러오는 중입니다.</p>
      </StatePanel>
    );
  }

  if (state.status === "error") {
    return (
      <StatePanel>
        <p>{state.error}</p>
        <button type="button" onClick={retry} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
          다시 시도
        </button>
      </StatePanel>
    );
  }

  if (state.campaigns.length === 0) {
    return (
      <StatePanel>
        <CalendarDays size={28} className="text-[#7dd3a3]" />
        <p>참여한 캠페인이 없습니다.</p>
        <Link href="/campaigns" className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
          캠페인 둘러보기
        </Link>
      </StatePanel>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {state.campaigns.map((campaign) => (
        <JoinedCampaignCard key={campaign.id} campaign={campaign} />
      ))}
    </div>
  );
}

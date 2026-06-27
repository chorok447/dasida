"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowLeft, Heart, Share2, MessageCircle, FileText, Bell } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { progressPercent } from "@/lib/progress";
import { apiPost, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useAuthedRefresh } from "@/lib/use-authed-refresh";
import { statusMeta, type Campaign } from "@/data/campaigns";
import { Avatar } from "@/components/avatar";

type Tab = "content" | "comments";

function StatusBadge({ c }: { c: Campaign }) {
  const m = statusMeta[c.status];
  return (
    <span
      className="text-[11px] tracking-[0.2em] px-3 py-1.5 rounded-full inline-block"
      style={{ background: m.color, color: m.fg }}
    >
      {m.label}
    </span>
  );
}

function HeaderCard({ c }: { c: Campaign }) {
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
            <img src={c.thumb} alt={c.title} className="w-full h-full object-cover" />
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
                <button
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.06)", color: "#ed5c48" }}
                >
                  <Heart size={16} />
                </button>
                <button
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.06)", color: dark ? "#f9f7f2" : "#1c4044" }}
                >
                  <Share2 size={16} />
                </button>
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
                  style={{ background: statusMeta[c.status].color }}
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

function CTABar({ c, onJoin, joining, disabled }: { c: Campaign; onJoin: () => void; joining: boolean; disabled: boolean }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  if (c.joinedByMe) {
    return (
      <div
        className="w-full py-5 rounded-2xl text-center font-medium"
        style={{ background: "rgba(125,211,163,0.18)", color: dark ? "#7dd3a3" : "#1c4044", fontSize: 16 }}
      >
        이미 참여한 캠페인입니다
      </div>
    );
  }
  if (c.status === "open") {
    return (
      <button
        onClick={onJoin}
        disabled={disabled}
        className="w-full py-5 rounded-2xl font-medium hover:-translate-y-0.5 transition-transform shadow-[0_30px_60px_-20px_rgba(125,211,163,0.6)] disabled:opacity-50"
        style={{ background: "#7dd3a3", color: "#0f1f22", fontSize: 17 }}
      >
        {joining ? "참여 처리 중…" : "캠페인 참여하기"}
      </button>
    );
  }
  if (c.status === "upcoming") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
        <div
          className="py-5 px-6 rounded-2xl text-center font-medium"
          style={{ background: "#148a90", color: "#ffffff", fontSize: 16 }}
        >
          {c.recruitStart} 00:00 모집을 시작합니다
        </div>
        <button
          onClick={() => alert("알림 신청은 준비 중입니다.")}
          className="py-5 px-6 rounded-2xl font-medium flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform"
          style={{ background: "#0d7479", color: "#ffffff" }}
        >
          <Bell size={16} /> 알림 신청
        </button>
      </div>
    );
  }
  return (
    <div
      className="w-full py-5 rounded-2xl text-center"
      style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.08)", color: dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}
    >
      모집이 마감되었습니다
    </div>
  );
}

function ContentTab({ c }: { c: Campaign }) {
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
            <img src={src} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CommentsTab() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  // 캠페인 댓글 API 는 아직 없음 → 실제 기능처럼 보이지 않게 준비 중 안내만 표시.
  return (
    <div
      className="rounded-3xl border p-10 text-center"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <MessageCircle size={28} className="mx-auto mb-4" style={{ color: dark ? "rgba(255,255,255,0.35)" : "rgba(28,64,68,0.35)" }} />
      <p className="text-[15px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
        캠페인 댓글 기능은 준비 중입니다.
      </p>
      <p className="mt-2 text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
        궁금한 점은 추후 문의 기능을 통해 남길 수 있어요.
      </p>
    </div>
  );
}

export default function CampaignDetailClient({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [tab, setTab] = useState<Tab>("content");
  const [c, setC] = useState(campaign);
  const [joining, setJoining] = useState(false);

  // 새로고침·로그인/로그아웃 시 참여·소유 상태를 함께 동기화한다.
  // identity 변경 시 사용자별 상태만 즉시 neutral(false), joined 숫자는 유지한다.
  const { refreshing, invalidatePending } = useAuthedRefresh<Campaign>(
    `/api/campaigns/${campaign.id}`,
    setC,
    () => setC((cur) => (
      cur.joinedByMe || cur.ownedByMe
        ? { ...cur, joinedByMe: false, ownedByMe: false }
        : cur
    )),
  );

  const join = async () => {
    if (!getToken()) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    setJoining(true);
    invalidatePending(); // 진행 중 재조회 결과가 참여 성공 결과를 덮어쓰지 않게
    const requestToken = getToken(); // 요청 identity 캡처
    try {
      const updated = await apiPost<Campaign>(`/api/campaigns/${c.id}/join`, {});
      if (getToken() !== requestToken) return; // 응답 전 로그아웃/토큰교체 → 무시
      setC(updated);
    } catch (e) {
      if (getToken() !== requestToken) return; // 이미 로그아웃한 사용자 재이동 방지
      if (e instanceof ApiError && e.status === 401) {
        alert("로그인이 필요합니다.");
        router.push("/login");
      } else if (e instanceof ApiError && e.status === 409) {
        alert("모집 정원이 가득 찼습니다.");
      } else if (e instanceof ApiError && e.status === 400) {
        alert("현재 참여할 수 없는 캠페인입니다.");
      } else {
        alert("참여에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <section
      className="relative min-h-screen pt-28 pb-20 px-6 transition-colors overflow-hidden"
      style={{
        position: "relative",
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-32 left-1/4 w-[500px] h-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <div className="max-w-5xl mx-auto relative">
        <button
          onClick={() => router.push("/campaigns")}
          className="mb-6 inline-flex items-center gap-2 text-[13px] opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
        >
          <ArrowLeft size={14} /> 캠페인 목록
        </button>

        <HeaderCard c={c} />

        <div className="mt-8 sticky top-20 z-10">
          <CTABar c={c} onJoin={join} joining={joining} disabled={joining || refreshing} />
        </div>

        <div className="mt-10 flex gap-2 border-b" style={{ borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)" }}>
          {([
            { id: "content", label: "캠페인 내용", icon: <FileText size={14} /> },
            { id: "comments", label: "문의", icon: <MessageCircle size={14} /> },
          ] as { id: Tab; label: string; icon: React.ReactNode }[]).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative px-5 py-3 inline-flex items-center gap-2 text-[14px]"
                style={{ color: active ? (dark ? "#f9f7f2" : "#0f1f22") : dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}
              >
                {t.icon}
                {t.label}
                {active && (
                  <motion.div
                    layoutId="detail-tab"
                    className="absolute left-0 right-0 -bottom-px h-0.5"
                    style={{ background: "#7dd3a3" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-8">
          {tab === "content" ? <ContentTab c={c} /> : <CommentsTab />}
        </div>
      </div>
    </section>
  );
}

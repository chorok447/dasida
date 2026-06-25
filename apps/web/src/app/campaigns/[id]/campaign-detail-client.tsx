"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowLeft, Heart, Share2, MessageCircle, FileText, Bell, Send } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { statusMeta, type Campaign } from "@/data/campaigns";
import { Avatar } from "@/components/avatar";

type Tab = "content" | "comments";

const comments = [
  {
    id: 1,
    name: "금잔디 명예소방관",
    time: "3시간",
    text: "캠페인 관련해서 궁금한게 있어서 댓글 남깁니다. 캠페인 이후 기부가 어떻게 진행되는지 자세하게 알려주실 수 있나요?",
    replies: [] as { id: number; name: string; verified?: boolean; text: string }[],
  },
  {
    id: 2,
    name: "익명의 고슴도치",
    time: "2일",
    text: "혹시 판매하실 의향도 있으신가요?",
    replies: [
      { id: 3, name: "김다시", verified: true, text: "원하시는 분들이 많아서 판매 열어보려고 합니다! 자세한건 나중에 공지 할게요!" },
    ],
  },
];

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
  const pct = Math.min(100, (c.joined / c.capacity) * 100);

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
            <div className="absolute top-4 left-4" style={{ transform: "translateZ(50px)" }}>
              <StatusBadge c={c} />
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

function CTABar({ c }: { c: Campaign }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  if (c.status === "open") {
    return (
      <button
        className="w-full py-5 rounded-2xl font-medium hover:-translate-y-0.5 transition-transform shadow-[0_30px_60px_-20px_rgba(125,211,163,0.6)]"
        style={{ background: "#7dd3a3", color: "#0f1f22", fontSize: 17 }}
      >
        캠페인 참여하기
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
  return (
    <div
      className="rounded-3xl border p-10"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <div
        className="flex items-center gap-3 p-3 rounded-2xl mb-8"
        style={{
          background: dark ? "rgba(255,255,255,0.04)" : "rgba(28,64,68,0.04)",
          border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.06)"}`,
        }}
      >
        <Avatar name="나" />
        <input
          placeholder="댓글 달기..."
          className="flex-1 bg-transparent outline-none text-[14px] placeholder:opacity-50"
          style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
        />
        <button className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#7dd3a3", color: "#0f1f22" }}>
          <Send size={14} />
        </button>
      </div>

      <div className="space-y-7">
        {comments.map((cm) => (
          <div key={cm.id} className="flex gap-3">
            <Avatar name={cm.name} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-[13px]">
                <span style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{cm.name}</span>
                <span className="opacity-50" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>· {cm.time}</span>
              </div>
              <p className="mt-1 text-[14px]" style={{ color: dark ? "rgba(255,255,255,0.85)" : "rgba(28,64,68,0.85)" }}>
                {cm.text}
              </p>
              <button className="mt-1.5 text-[12px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
                답글 달기
              </button>
              {cm.replies.length > 0 && (
                <div className="mt-4 space-y-4 pl-4 border-l-2" style={{ borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)" }}>
                  {cm.replies.map((r) => (
                    <div key={r.id} className="flex gap-3">
                      <Avatar name={r.name} verified={r.verified} />
                      <div>
                        <div className="text-[13px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
                          {r.name}
                        </div>
                        <p className="mt-0.5 text-[14px]" style={{ color: dark ? "rgba(255,255,255,0.85)" : "rgba(28,64,68,0.85)" }}>
                          {r.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CampaignDetailClient({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [tab, setTab] = useState<Tab>("content");
  const c = campaign;

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
          <CTABar c={c} />
        </div>

        <div className="mt-10 flex gap-2 border-b" style={{ borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)" }}>
          {([
            { id: "content", label: "캠페인 내용", icon: <FileText size={14} /> },
            { id: "comments", label: "댓글보기", icon: <MessageCircle size={14} /> },
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

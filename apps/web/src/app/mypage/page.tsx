"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Heart, MessageCircle, Bookmark, Share2, Calendar, Users } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { fashionPhotos, naturePhotos, peoplePhotos, objectPhotos, workshopPhotos, marketPhotos } from "@/data/photos";
import { ME_AVATAR } from "@/data/avatars";

type Tab = "feed" | "campaign" | "likes";

const feed = [
  { img: fashionPhotos[0], title: "낡은 청바지로 만든 토트백" },
  { img: workshopPhotos[1], title: "주말 공방 클래스 후기" },
  { img: naturePhotos[1], title: "도시 정원 화분 키트" },
  { img: objectPhotos[0], title: "유리병 캔들 메이킹" },
  { img: marketPhotos[1], title: "기증 마켓 후기" },
  { img: peoplePhotos[0], title: "한강 플로깅 데이" },
];

const campaigns = [
  { tag: "OPEN", title: "한강공원 플로깅", date: "06.28 · SAT", members: 24 },
  { tag: "FULL", title: "도시 텃밭 워크숍", date: "07.05 · SAT", members: 18 },
  { tag: "SOON", title: "헌 옷 기증 마켓", date: "07.12 · SAT", members: 9 },
];

function TiltMini({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 200, damping: 22 });
  const sy = useSpring(my, { stiffness: 200, damping: 22 });
  const rY = useTransform(sx, [-0.5, 0.5], [-12, 12]);
  const rX = useTransform(sy, [-0.5, 0.5], [10, -10]);

  return (
    <div style={{ perspective: 1000 }}>
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
        style={{ rotateX: rX, rotateY: rY, transformStyle: "preserve-3d" }}
        className="h-full"
      >
        {children}
      </motion.div>
    </div>
  );
}

function ProfileHeader() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div className="flex items-center gap-6 pt-32 pb-12 px-8 max-w-5xl mx-auto">
      <div className="relative">
        <img
          src={ME_AVATAR}
          alt="프로필"
          className="w-28 h-28 rounded-full object-cover"
          style={{ boxShadow: "0 30px 60px -15px rgba(0,0,0,0.5)" }}
        />
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#7dd3a3] flex items-center justify-center text-[#0f1f22] ring-2 ring-white">
          ✓
        </div>
      </div>
      <div>
        <h1
          style={{
            fontFamily: "'Black Han Sans', sans-serif",
            fontSize: 40,
            color: dark ? "#f9f7f2" : "#0f1f22",
          }}
        >
          다시다시
        </h1>
        <p className="mt-1" style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}>
          dasikim@gmail.com · 업사이클러
        </p>
        <div className="flex gap-6 mt-3 text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}>
          <span><b style={{ color: "#7dd3a3" }}>128</b> 게시물</span>
          <span><b style={{ color: "#7dd3a3" }}>2.4k</b> 팔로워</span>
          <span><b style={{ color: "#7dd3a3" }}>312</b> 팔로잉</span>
        </div>
      </div>
    </div>
  );
}

function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const items: { id: Tab; label: string }[] = [
    { id: "feed", label: "피드" },
    { id: "campaign", label: "캠페인" },
    { id: "likes", label: "좋아요" },
  ];
  return (
    <div
      className="max-w-5xl mx-auto px-8 flex gap-2 border-b"
      style={{ borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)" }}
    >
      {items.map((it) => {
        const active = tab === it.id;
        return (
          <button
            key={it.id}
            onClick={() => setTab(it.id)}
            className="relative px-6 py-3"
            style={{ color: active ? (dark ? "#f9f7f2" : "#0f1f22") : dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}
          >
            {it.label}
            {active && (
              <motion.div
                layoutId="tab-underline"
                className="absolute left-0 right-0 -bottom-px h-0.5"
                style={{ background: "#7dd3a3" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function FeedGrid() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {feed.map((f, i) => (
        <TiltMini key={i}>
          <div
            className="rounded-2xl overflow-hidden border shadow-[0_20px_40px_-20px_rgba(0,0,0,0.4)]"
            style={{
              background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
              borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
            }}
          >
            <div className="relative aspect-[4/5] overflow-hidden">
              <img src={f.img} alt={f.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f1f22]/80 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                <span className="text-[13px]">{f.title}</span>
                <div className="flex gap-3 text-[12px] opacity-80">
                  <span className="flex items-center gap-1"><Heart size={12} /> 24</span>
                  <span className="flex items-center gap-1"><MessageCircle size={12} /> 3</span>
                </div>
              </div>
            </div>
          </div>
        </TiltMini>
      ))}
    </div>
  );
}

function CampaignList() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div className="space-y-4">
      {campaigns.map((c, i) => (
        <TiltMini key={i}>
          <div
            className="flex items-center gap-6 p-6 rounded-2xl border"
            style={{
              background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
              borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#1c4044", color: "#7dd3a3" }}
            >
              <Calendar size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] tracking-[0.2em] px-2 py-0.5 rounded"
                  style={{
                    background: c.tag === "OPEN" ? "#7dd3a3" : c.tag === "FULL" ? "rgba(28,64,68,0.5)" : "#e7dfcb",
                    color: c.tag === "FULL" ? "#fff" : "#0f1f22",
                  }}
                >
                  {c.tag}
                </span>
                <span className="text-[12px]" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
                  {c.date}
                </span>
              </div>
              <h3
                style={{
                  fontFamily: "'Black Han Sans', sans-serif",
                  fontSize: 22,
                  color: dark ? "#f9f7f2" : "#0f1f22",
                }}
              >
                {c.title}
              </h3>
            </div>
            <div className="flex items-center gap-2" style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}>
              <Users size={16} />
              <span>{c.members}</span>
            </div>
          </div>
        </TiltMini>
      ))}
    </div>
  );
}

function LikesGrid() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {feed.concat(feed).slice(0, 8).map((f, i) => (
        <TiltMini key={i}>
          <div className="relative aspect-square rounded-xl overflow-hidden border shadow-[0_15px_30px_-15px_rgba(0,0,0,0.4)]"
            style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}>
            <img src={f.img} alt="" className="w-full h-full object-cover" />
            <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#ed5c48] text-white flex items-center justify-center">
              <Heart size={14} fill="white" />
            </div>
            <div className="absolute bottom-2 left-2 right-2 flex justify-between text-white text-[11px]">
              <Bookmark size={14} />
              <Share2 size={14} />
            </div>
          </div>
        </TiltMini>
      ))}
    </div>
  );
}

export default function MyPage() {
  const [tab, setTab] = useState<Tab>("feed");
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <section
      className="relative min-h-screen transition-colors"
      style={{
        position: "relative",
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>
      <div className="relative">
        <ProfileHeader />
        <Tabs tab={tab} setTab={setTab} />
        <div className="max-w-5xl mx-auto px-8 py-10">
          {tab === "feed" && <FeedGrid />}
          {tab === "campaign" && <CampaignList />}
          {tab === "likes" && <LikesGrid />}
        </div>
      </div>
    </section>
  );
}

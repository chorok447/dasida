"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { motion } from "motion/react";
import { Heart, MessageCircle, Megaphone, Settings, Bell } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { notifications, type NotifKind } from "@/data/notifications";

type Filter = "all" | NotifKind;

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "like", label: "좋아요" },
  { id: "comment", label: "댓글" },
  { id: "campaign", label: "캠페인" },
  { id: "system", label: "시스템" },
];

const iconFor: Record<NotifKind, React.ReactNode> = {
  like: <Heart size={16} />,
  comment: <MessageCircle size={16} />,
  campaign: <Megaphone size={16} />,
  system: <Bell size={16} />,
};

const colorFor: Record<NotifKind, string> = {
  like: "#ed5c48",
  comment: "#7dd3a3",
  campaign: "#148a90",
  system: "#afa58d",
};

export default function NotificationsPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [filter, setFilter] = useState<Filter>("all");
  const list = notifications.filter((n) => filter === "all" || n.kind === filter);

  const [push, setPush] = useState(true);
  const [emails, setEmails] = useState(false);
  const [campaign, setCampaign] = useState(true);

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
        <div className="absolute top-40 left-1/3 w-[500px] h-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <div className="max-w-5xl mx-auto relative">
        <div className="text-center mb-10">
          <p className="tracking-[0.4em] uppercase mb-3" style={{ color: dark ? "#7dd3a3" : "#1c4044", fontSize: 11 }}>
            Notifications
          </p>
          <h1 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: "clamp(36px, 4.5vw, 60px)", color: dark ? "#f9f7f2" : "#0f1f22" }}>
            알림
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <div>
            <div className="flex gap-1 p-1 rounded-full mb-6 w-fit" style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}>
              {filters.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className="relative px-4 py-2 text-[13px] rounded-full"
                    style={{ color: active ? "#0f1f22" : dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}
                  >
                    {active && <motion.div layoutId="notif-pill" className="absolute inset-0 rounded-full" style={{ background: "#7dd3a3" }} />}
                    <span className="relative">{f.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              {list.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center gap-4 p-4 rounded-2xl border transition-colors"
                  style={{
                    background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
                    borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
                  }}
                >
                  <div className="relative">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: colorFor[n.kind] + "22", color: colorFor[n.kind] }}
                    >
                      {iconFor[n.kind]}
                    </div>
                    {n.unread && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#7dd3a3]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{n.title}</div>
                    <div className="text-[12px] opacity-70 truncate" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{n.body}</div>
                  </div>
                  {n.thumb && (
                    <img src={n.thumb} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <span className="text-[11px] opacity-60 flex-shrink-0" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{n.time}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="hidden lg:block">
            <div
              className="rounded-2xl border p-5 sticky top-24"
              style={{ background: dark ? "rgba(255,255,255,0.04)" : "#ffffff", borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Settings size={14} style={{ color: "#7dd3a3" }} />
                <h3 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 18, color: dark ? "#f9f7f2" : "#0f1f22" }}>알림 설정</h3>
              </div>
              {[
                { label: "푸시 알림", v: push, set: setPush },
                { label: "이메일 알림", v: emails, set: setEmails },
                { label: "캠페인 알림", v: campaign, set: setCampaign },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2.5">
                  <span className="text-[13px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{row.label}</span>
                  <button
                    onClick={() => row.set(!row.v)}
                    className="w-10 h-5 rounded-full p-0.5 transition-colors"
                    style={{ background: row.v ? "#7dd3a3" : dark ? "rgba(255,255,255,0.15)" : "rgba(28,64,68,0.15)" }}
                  >
                    <motion.div
                      animate={{ x: row.v ? 20 : 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="w-4 h-4 rounded-full bg-white"
                    />
                  </button>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

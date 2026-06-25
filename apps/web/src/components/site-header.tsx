"use client";

import { Bell } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "@/lib/theme-context";

// ponytail: 라우팅 미연결 정적 헤더. 다른 페이지 이식 시 next/link로 교체.
const items = [
  { id: "home", label: "홈" },
  { id: "home-feed", label: "피드" },
  { id: "campaigns", label: "캠페인" },
  { id: "mypage", label: "마이페이지" },
  { id: "logos", label: "로고" },
];

export function SiteHeader() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const active = "home";

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 backdrop-blur-xl border-b transition-colors"
      style={{
        background: dark ? "rgba(15,31,34,0.55)" : "rgba(249,247,242,0.7)",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
        <span
          className="flex items-center gap-2"
          style={{ color: dark ? "#7dd3a3" : "#1c4044" }}
        >
          <span style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 22 }}>다시,다</span>
          <span className="text-[10px] tracking-[0.3em] opacity-60">UPCYCLE</span>
        </span>
        <nav className="hidden md:flex items-center gap-1">
          {items.map((it) => {
            const isActive = active === it.id;
            return (
              <span
                key={it.id}
                className="relative px-4 py-2 text-[14px] transition-opacity"
                style={{ color: dark ? "#f9f7f2" : "#1c4044", opacity: isActive ? 1 : 0.7 }}
              >
                {it.label}
                {isActive && (
                  <motion.div
                    layoutId="navdot"
                    className="absolute left-1/2 -translate-x-1/2 bottom-1 w-1.5 h-1.5 rounded-full"
                    style={{ background: "#7dd3a3" }}
                  />
                )}
              </span>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center relative"
            style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.06)", color: dark ? "#f9f7f2" : "#1c4044" }}
            aria-label="알림"
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#7dd3a3]" />
          </span>
          <span
            className="text-[13px] px-3 py-1.5 rounded-full transition-colors"
            style={{ color: dark ? "rgba(255,255,255,0.8)" : "rgba(28,64,68,0.8)" }}
          >
            로그인
          </span>
          <span
            className="text-[13px] px-3 py-1.5 rounded-full font-medium"
            style={{ background: "#7dd3a3", color: "#0f1f22" }}
          >
            회원가입
          </span>
        </div>
      </div>
    </header>
  );
}

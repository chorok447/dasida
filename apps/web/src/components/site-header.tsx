"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "@/lib/theme-context";

// href가 있으면 링크, 없으면 아직 미구현 페이지(비활성 표시).
const items: { label: string; href?: string }[] = [
  { label: "홈", href: "/" },
  { label: "피드" },
  { label: "캠페인", href: "/campaigns" },
  { label: "마이페이지", href: "/mypage" },
  { label: "로고" },
];

export function SiteHeader() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const pathname = usePathname();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 backdrop-blur-xl border-b transition-colors"
      style={{
        background: dark ? "rgba(15,31,34,0.55)" : "rgba(249,247,242,0.7)",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" style={{ color: dark ? "#7dd3a3" : "#1c4044" }}>
          <span style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 22 }}>다시,다</span>
          <span className="text-[10px] tracking-[0.3em] opacity-60">UPCYCLE</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {items.map((it) => {
            const isActive = it.href === pathname;
            const className = "relative px-4 py-2 text-[14px] transition-opacity";
            const style = { color: dark ? "#f9f7f2" : "#1c4044", opacity: isActive ? 1 : 0.7 };
            const dot = isActive && (
              <motion.div
                layoutId="navdot"
                className="absolute left-1/2 -translate-x-1/2 bottom-1 w-1.5 h-1.5 rounded-full"
                style={{ background: "#7dd3a3" }}
              />
            );
            return it.href ? (
              <Link key={it.label} href={it.href} className={className} style={style}>
                {it.label}
                {dot}
              </Link>
            ) : (
              <span key={it.label} className={`${className} cursor-default`} style={{ ...style, opacity: 0.4 }}>
                {it.label}
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
          <Link
            href="/login"
            className="text-[13px] px-3 py-1.5 rounded-full transition-colors"
            style={{ color: dark ? "rgba(255,255,255,0.8)" : "rgba(28,64,68,0.8)" }}
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="text-[13px] px-3 py-1.5 rounded-full font-medium"
            style={{ background: "#7dd3a3", color: "#0f1f22" }}
          >
            회원가입
          </Link>
        </div>
      </div>
    </header>
  );
}

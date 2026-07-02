"use client";

import { useTheme } from "@/lib/theme-context";

export function Footer() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <footer
      className="py-10 px-8 transition-colors"
      style={{ background: dark ? "#0f1f22" : "#1c4044", color: "rgba(255,255,255,0.6)" }}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <p style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 22, color: "#7dd3a3" }}>다시, 다</p>
        <p className="text-[12px] tracking-[0.3em] uppercase">© 2026 Upcycle Project · 서비스 소개 · 팀 소개</p>
      </div>
    </footer>
  );
}

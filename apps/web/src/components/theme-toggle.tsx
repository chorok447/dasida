"use client";

import { Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "@/lib/theme-context";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      onClick={toggle}
      className="fixed bottom-20 right-6 z-50 h-9 w-16 rounded-full border p-1 shadow-lg backdrop-blur-md transition-colors md:bottom-6"
      style={{
        // 푸터(--surface-deep, 라이트에서 노브 색과 동일) 위에서도 묻히지 않게 트랙은 불투명 서피스로
        background: "rgba(var(--surface-rgb), 0.92)",
        borderColor: "rgba(var(--ink-rgb), 0.25)",
      }}
      aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}
    >
      <motion.div
        animate={{ x: dark ? 0 : 28 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="w-7 h-7 rounded-full flex items-center justify-center"
        style={{ background: "var(--accent-secondary)", color: "var(--surface)" }}
      >
        {dark ? <Moon size={14} /> : <Sun size={14} />}
      </motion.div>
    </button>
  );
}

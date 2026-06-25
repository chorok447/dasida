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
      className="fixed bottom-6 right-6 z-50 w-16 h-9 rounded-full p-1 backdrop-blur-md border transition-colors"
      style={{
        background: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)",
        borderColor: dark ? "rgba(255,255,255,0.25)" : "rgba(28,64,68,0.2)",
      }}
      aria-label="Toggle theme"
    >
      <motion.div
        animate={{ x: dark ? 0 : 28 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="w-7 h-7 rounded-full flex items-center justify-center"
        style={{ background: dark ? "#7dd3a3" : "#1c4044", color: dark ? "#0f1f22" : "#e7dfcb" }}
      >
        {dark ? <Moon size={14} /> : <Sun size={14} />}
      </motion.div>
    </button>
  );
}

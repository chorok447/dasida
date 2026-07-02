"use client";

import type { HTMLAttributes } from "react";
import { useTheme } from "@/lib/theme-context";

export function StatePanel({
  children,
  className = "",
  compact = false,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { compact?: boolean }) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <div
      {...props}
      className={`flex ${compact ? "min-h-36" : "min-h-56"} flex-col items-center justify-center gap-4 rounded-3xl border px-6 text-center text-[14px] ${className}`}
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
        color: dark ? "#f9f7f2" : "#0f1f22",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

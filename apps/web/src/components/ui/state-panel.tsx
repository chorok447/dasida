"use client";

import type { HTMLAttributes } from "react";

export function StatePanel({
  children,
  className = "",
  compact = false,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { compact?: boolean }) {
  return (
    <div
      {...props}
      className={`flex ${compact ? "min-h-36" : "min-h-56"} flex-col items-center justify-center gap-4 rounded-3xl border px-6 text-center text-[14px] ${className}`}
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        color: "var(--foreground)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

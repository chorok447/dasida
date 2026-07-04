"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

export function Pagination({
  page,
  totalPages,
  totalElements,
  disabled = false,
  compact = false,
  className = "",
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalElements?: number;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  onPageChange: (page: number) => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  if (totalPages <= 0) return null;

  const borderColor = dark ? "rgba(255,255,255,0.15)" : "rgba(28,64,68,0.15)";
  const foreground = dark ? "#f9f7f2" : "#0f1f22";
  const buttonClass = `inline-flex flex-1 items-center justify-center gap-1 border transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 motion-reduce:transform-none sm:flex-none ${compact ? "rounded-full px-4 py-2 text-[12px]" : "rounded-xl px-4 py-2.5 text-[13px]"}`;

  return (
    <nav
      aria-label="페이지 탐색"
      aria-busy={disabled || undefined}
      className={`flex flex-col items-center gap-3 sm:flex-row ${totalElements === undefined ? "sm:justify-center" : "sm:justify-between"} ${className}`}
      style={{ color: foreground }}
    >
      {totalElements === undefined ? null : (
        <span className="text-[12px] opacity-65">총 {totalElements.toLocaleString()}개</span>
      )}
      <div className="flex w-full max-w-sm items-center justify-center gap-2 sm:w-auto">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={disabled || page <= 0}
          className={buttonClass}
          style={{ borderColor, background: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.55)" }}
          aria-label="이전 페이지"
        >
          <ChevronLeft size={14} aria-hidden="true" /> 이전
        </button>
        <span className="min-w-20 text-center text-[12px] opacity-65" aria-current="page">
          {page + 1} / {totalPages} 페이지
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page + 1 >= totalPages}
          className={buttonClass}
          style={{ borderColor: "#7dd3a3", background: "#7dd3a3", color: "#0f1f22" }}
          aria-label="다음 페이지"
        >
          다음 <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

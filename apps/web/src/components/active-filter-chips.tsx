"use client";

import { X } from "lucide-react";

export type FilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

export function ActiveFilterChips({
  chips,
  onClearAll,
  clearLabel = "필터 초기화",
}: {
  chips: FilterChip[];
  onClearAll?: () => void;
  clearLabel?: string;
}) {

  if (chips.length === 0) return null;

  return (
    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0">
      <span className="text-[12px] opacity-60" style={{ color: "var(--foreground)" }}>
        적용 중
      </span>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3a3]"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent-secondary)",
          }}
          aria-label={`${chip.label} 필터 제거`}
        >
          <span className="truncate">{chip.label}</span>
          <X size={12} aria-hidden />
        </button>
      ))}
      {onClearAll ? (
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-full px-3 py-1.5 text-[12px] underline underline-offset-2 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3a3]"
          style={{ color: "var(--foreground)" }}
        >
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}

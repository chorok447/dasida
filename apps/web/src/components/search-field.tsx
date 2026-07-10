"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

type SearchFieldProps = {
  value: string;
  onCommit: (query: string) => void;
  placeholder: string;
  label: string;
  debounceMs?: number;
  loading?: boolean;
  className?: string;
};

export function SearchField({
  value,
  onCommit,
  placeholder,
  label,
  debounceMs = 300,
  loading = false,
  className = "",
}: SearchFieldProps) {
  const [draft, setDraft] = useState(value);
  const commitRef = useRef(onCommit);

  useEffect(() => {
    commitRef.current = onCommit;
  }, [onCommit]);

  const commitNow = useCallback((next: string) => {
    const normalized = next.trim();
    setDraft(normalized);
    commitRef.current(normalized);
  }, []);

  useEffect(() => {
    if (debounceMs <= 0) return;
    const normalized = draft.trim();
    if (normalized === value) return;
    const timeout = window.setTimeout(() => commitRef.current(normalized), debounceMs);
    return () => window.clearTimeout(timeout);
  }, [debounceMs, draft, value]);

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-2xl border px-3 py-2 sm:px-4 sm:py-2.5 ${className}`}
      style={{
        background: "var(--card)",
        borderColor: "rgba(var(--ink-rgb), 0.1)",
      }}
    >
      <Search size={18} className="shrink-0 opacity-50" aria-hidden />
      <label className="sr-only">{label}</label>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitNow(draft);
          }
        }}
        maxLength={100}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:opacity-45 focus-visible:ring-0"
        style={{ color: "var(--foreground)" }}
      />
      {draft ? (
        <button
          type="button"
          onClick={() => commitNow("")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[rgba(var(--ink-rgb),0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3a3]"
          aria-label="검색어 지우기"
        >
          <X size={16} className="opacity-60" aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => commitNow(draft)}
        disabled={loading}
        aria-busy={loading}
        aria-label="검색"
        className="flex h-9 shrink-0 items-center justify-center rounded-full px-3 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1f22]"
        style={{ background: "#7dd3a3", color: "#0f1f22" }}
      >
        {loading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : "검색"}
      </button>
    </div>
  );
}

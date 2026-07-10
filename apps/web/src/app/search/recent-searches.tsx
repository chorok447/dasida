"use client";

import { useSyncExternalStore } from "react";
import { Clock3, X } from "lucide-react";
import {
  clearRecentSearches,
  getRecentSearches,
  getServerRecentSearches,
  removeRecentSearch,
  subscribeRecentSearches,
} from "@/lib/recent-searches";

/** 검색어가 비어 있을 때 최근 검색어 칩을 보여준다. 선택 시 즉시 검색. */
export function RecentSearches({ onSelect }: { onSelect: (query: string) => void }) {
  const items = useSyncExternalStore(subscribeRecentSearches, getRecentSearches, getServerRecentSearches);
  if (items.length === 0) return null;

  return (
    <section aria-label="최근 검색어" className="mx-auto mt-4 max-w-3xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] opacity-60" style={{ color: "var(--foreground)" }}>
          <Clock3 size={13} aria-hidden /> 최근 검색어
        </span>
        <button
          type="button"
          onClick={clearRecentSearches}
          className="rounded-md px-1.5 py-0.5 text-[12px] opacity-60 transition-opacity hover:opacity-100"
          style={{ color: "var(--foreground)" }}
        >
          전체 지우기
        </button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {items.map((term) => (
          <li
            key={term}
            className="flex items-center gap-1 rounded-full border pl-3 pr-1.5 py-1"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <button
              type="button"
              onClick={() => onSelect(term)}
              className="max-w-[180px] truncate text-[13px]"
              style={{ color: "var(--foreground)" }}
            >
              {term}
            </button>
            <button
              type="button"
              onClick={() => removeRecentSearch(term)}
              aria-label={`최근 검색어 삭제: ${term}`}
              className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-[rgba(var(--ink-rgb),0.08)]"
            >
              <X size={12} className="opacity-55" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

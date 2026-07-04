"use client";

import { motion } from "motion/react";
import { useTheme } from "@/lib/theme-context";
import { MYPAGE_TAB_GROUPS, type MypageTab } from "./mypage-types";

export function MypageTabBar({
  tab,
  onSelect,
}: {
  tab: MypageTab;
  onSelect: (tab: MypageTab) => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <div
      className="mx-auto max-w-5xl border-b px-4 sm:px-8"
      style={{ borderColor: dark ? "rgba(255,255,255,0.1)" : "var(--border)" }}
    >
      <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-end sm:gap-6">
        {MYPAGE_TAB_GROUPS.map((group) => (
          <div key={group.label} className="min-w-0">
            <p
              className="mb-1.5 px-1 text-[10px] font-medium tracking-[0.2em] uppercase"
              style={{ color: "var(--foreground-muted)" }}
            >
              {group.label}
            </p>
            <div
              role="tablist"
              aria-label={`${group.label} 메뉴`}
              className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {group.tabs.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={`mypage-tab-${item.id}`}
                    aria-selected={active}
                    aria-controls={`mypage-panel-${item.id}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => onSelect(item.id)}
                    className="relative shrink-0 rounded-lg px-3 py-2 text-[13px] transition-colors sm:px-4"
                    style={{
                      color: active ? (dark ? "#f9f7f2" : "var(--foreground)") : "var(--foreground-muted)",
                      fontWeight: active ? 600 : 400,
                      background: active ? (dark ? "rgba(255,255,255,0.06)" : "var(--accent-soft)") : undefined,
                    }}
                  >
                    {item.label}
                    {active ? (
                      <motion.div
                        layoutId="mypage-tab-underline"
                        className="absolute inset-x-2 -bottom-3 h-0.5 rounded-full sm:-bottom-3"
                        style={{ background: "#7dd3a3" }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

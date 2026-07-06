"use client";

import { TrendingUp } from "lucide-react";
import { FallbackImage } from "@/components/fallback-image";
import { statusMeta, type Campaign } from "@/data/campaigns";
import { progressPercent } from "@/lib/progress";
import { useTheme } from "@/lib/theme-context";

const cardStyle = {
  background: "var(--card)",
  borderColor: "var(--border)",
};

export function FeedSideHot({ campaigns }: { campaigns: Campaign[] }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div className="rounded-2xl border p-5" style={cardStyle}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={14} style={{ color: "var(--accent)" }} />
        <h3 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 18, color: "var(--foreground)" }}>
          진행 중인 캠페인
        </h3>
      </div>
      <div className="space-y-3">
        {campaigns.map((c) => {
          const pct = progressPercent(c.joined, c.capacity);
          return (
            <div key={c.id} className="flex gap-3 items-center">
              <FallbackImage
                src={c.thumb}
                alt={`${c.title} 캠페인 이미지`}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] truncate" style={{ color: "var(--foreground)" }}>
                  {c.title}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 rounded-full" style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.08)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: statusMeta[c.status].color }} />
                  </div>
                  <span className="text-[11px] opacity-60" style={{ color: "var(--foreground)" }}>{pct}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

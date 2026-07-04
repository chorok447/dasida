"use client";

import { useTheme } from "@/lib/theme-context";

// 목록 로딩용 스켈레톤 카드. 부모가 grid className을 넘겨 실제 목록 레이아웃과 맞춘다.
// animate-pulse는 globals.css의 prefers-reduced-motion 블록으로 자동 정지된다.
export function SkeletonCards({ count = 6, className = "" }: { count?: number; className?: string }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const bone = dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)";

  return (
    <div className={className} role="status" aria-label="목록을 불러오는 중">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-2xl border"
          style={{
            background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
            borderColor: bone,
          }}
        >
          <div className="h-40" style={{ background: bone }} />
          <div className="space-y-3 p-5">
            <div className="h-4 w-3/4 rounded-full" style={{ background: bone }} />
            <div className="h-3 w-1/2 rounded-full" style={{ background: bone }} />
            <div className="h-3 w-1/3 rounded-full" style={{ background: bone }} />
          </div>
        </div>
      ))}
    </div>
  );
}

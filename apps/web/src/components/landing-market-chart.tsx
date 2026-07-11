"use client";

import { useReducedMotion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// 랜딩 스토리텔링용 수치. 시장 규모는 업계 추정 기반 근사치(억원).
const marketGrowth = [
  { year: "2018", value: 34 },
  { year: "2019", value: 42 },
  { year: "2020", value: 56 },
  { year: "2021", value: 75 },
  { year: "2022", value: 98 },
  { year: "2023", value: 130 },
  { year: "2024", value: 168 },
  { year: "2025", value: 210 },
];

const ACCENT = "var(--accent)";
const INK = "#f9f7f2";
const MUTED = "rgba(249,247,242,0.6)";
const HAIRLINE = "rgba(249,247,242,0.08)";

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-[12px]"
      style={{ background: "var(--surface-dark)", borderColor: "rgba(249,247,242,0.15)", color: INK }}
    >
      <span style={{ color: MUTED }}>{label}년 </span>
      <span className="font-medium">{payload[0].value.toLocaleString()}억원</span>
    </div>
  );
}

/**
 * 랜딩 시장 규모 차트. recharts(+d3)가 무거워 landing-stats 에서 next/dynamic 으로
 * 지연 로딩한다 — 랜딩 첫 JS 에서 차트 라이브러리를 제외하기 위한 분리이므로
 * 이 파일을 다시 정적 import 하지 말 것. dynamic() 용 default export.
 */
export default function LandingMarketChart() {
  const reduce = useReducedMotion();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={marketGrowth} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="landing-market-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={HAIRLINE} vertical={false} />
        <XAxis dataKey="year" tick={{ fill: MUTED, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: MUTED, fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: HAIRLINE }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={ACCENT}
          strokeWidth={2}
          fill="url(#landing-market-fill)"
          activeDot={{ r: 5, fill: ACCENT, stroke: "var(--surface-dark)", strokeWidth: 2 }}
          isAnimationActive={!reduce}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

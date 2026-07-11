"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAdminStats, type AdminDailyStat } from "@/data/admin";

const RANGE_OPTIONS = [7, 30, 90] as const;

const SERIES = [
  { key: "signups", label: "가입", color: "var(--accent)" },
  { key: "posts", label: "게시글", color: "#148a90" },
  { key: "campaigns", label: "캠페인", color: "#d9a441" },
  { key: "reports", label: "신고", color: "#ed5c48" },
] as const;

// 저장된 결과의 key 가 현재 요청 key 와 다르면 로딩 중으로 간주한다(dashboard-client 패턴).
type StatsResult = { key: string; status: "success" | "error"; daily: AdminDailyStat[] };

/** "2026-07-09" → "7.9" 축 라벨. */
function shortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}.${Number(day)}`;
}

export function StatsChartSection() {
  const [days, setDays] = useState<number>(30);
  const [retryTick, setRetryTick] = useState(0);
  const [result, setResult] = useState<StatsResult | null>(null);

  const requestKey = `${days}:${retryTick}`;

  useEffect(() => {
    let cancelled = false;
    fetchAdminStats(days)
      .then((res) => {
        if (!cancelled) setResult({ key: requestKey, status: "success", daily: res.daily });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: requestKey, status: "error", daily: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [days, retryTick, requestKey]);

  const loading = result === null || result.key !== requestKey;

  return (
    <section
      className="rounded-3xl border p-5"
      style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-[14px] font-semibold">
          <TrendingUp size={16} aria-hidden style={{ color: "var(--accent-secondary)" }} />
          일별 추이
        </h2>
        <div className="flex gap-1" role="group" aria-label="조회 기간">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDays(option)}
              aria-pressed={days === option}
              className="rounded-full border px-3 py-1 text-[12px]"
              style={
                days === option
                  ? { background: "var(--accent)", borderColor: "var(--accent)", color: "var(--surface-dark)" }
                  : { background: "transparent", borderColor: "var(--border)", color: "var(--foreground-muted)" }
              }
            >
              {option}일
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-[13px]" style={{ color: "var(--foreground-muted)" }}>
          통계를 불러오는 중입니다…
        </p>
      ) : result.status === "error" ? (
        <p className="py-10 text-center text-[13px]" style={{ color: "var(--foreground-muted)" }}>
          통계를 불러오지 못했습니다.{" "}
          <button
            type="button"
            onClick={() => setRetryTick((t) => t + 1)}
            className="underline"
            style={{ color: "var(--foreground)" }}
          >
            다시 시도
          </button>
        </p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.daily} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fontSize: 11, fill: "var(--foreground-muted)" }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--foreground-muted)" }} tickLine={false} />
              <Tooltip
                labelFormatter={(label) => String(label)}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--foreground)",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {SERIES.map(({ key, label, color }) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={label}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

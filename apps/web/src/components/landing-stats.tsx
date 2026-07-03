"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ScrollReveal } from "@/components/scroll-reveal";

// 랜딩 스토리텔링용 수치. 시장 규모는 업계 추정 기반 근사치(억원), 재활용률은 환경부 통계 기반.
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

const kpis = [
  { value: 12400, suffix: "+", label: "함께한 업사이클러" },
  { value: 38000, suffix: "+", label: "공유된 재탄생 이야기" },
  { value: 640, suffix: "+", label: "진행된 캠페인" },
];

const ACCENT = "#7dd3a3";
const INK = "#f9f7f2";
const MUTED = "rgba(249,247,242,0.6)";
const HAIRLINE = "rgba(249,247,242,0.08)";

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduce) {
      el.textContent = `${to.toLocaleString()}${suffix}`;
      return;
    }
    const controls = animate(0, to, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = `${Math.round(v).toLocaleString()}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, to, suffix, reduce]);

  return <span ref={ref}>{`0${suffix}`}</span>;
}

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
      style={{ background: "#0f1f22", borderColor: "rgba(249,247,242,0.15)", color: INK }}
    >
      <span style={{ color: MUTED }}>{label}년 </span>
      <span className="font-medium">{payload[0].value.toLocaleString()}억원</span>
    </div>
  );
}

export function LandingStats() {
  const reduce = useReducedMotion();

  return (
    <section
      className="relative py-32 px-8 transition-colors"
      style={{ background: "linear-gradient(180deg,#0f1f22,#1c4044)" }}
    >
      <div className="max-w-6xl mx-auto">
        <ScrollReveal className="text-center mb-16">
          <p className="tracking-[0.4em] uppercase mb-4" style={{ color: ACCENT }}>
            Impact in Numbers
          </p>
          <h2
            style={{
              fontFamily: "'Black Han Sans', sans-serif",
              fontSize: "clamp(40px, 5vw, 72px)",
              color: INK,
            }}
          >
            숫자로 보는 다시, 다
          </h2>
          <p className="mt-6 max-w-2xl mx-auto" style={{ color: MUTED }}>
            버려질 뻔한 것들이 만들어낸 변화입니다. 업사이클링은 취향을 넘어 산업이 되고
            있습니다.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
          {kpis.map((kpi, i) => (
            <ScrollReveal key={kpi.label} delay={i * 0.12}>
              <div
                className="rounded-3xl border p-8 text-center h-full"
                style={{ borderColor: HAIRLINE, background: "rgba(249,247,242,0.04)" }}
              >
                <p
                  style={{
                    fontFamily: "'Black Han Sans', sans-serif",
                    fontSize: "clamp(36px, 4vw, 52px)",
                    color: ACCENT,
                    lineHeight: 1.1,
                  }}
                >
                  <CountUp to={kpi.value} suffix={kpi.suffix} />
                </p>
                <p className="mt-3 text-[14px]" style={{ color: MUTED }}>
                  {kpi.label}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <ScrollReveal className="lg:col-span-3">
            <div
              className="rounded-3xl border p-8 h-full"
              style={{ borderColor: HAIRLINE, background: "rgba(249,247,242,0.04)" }}
            >
              <h3 className="text-[15px] font-medium" style={{ color: INK }}>
                국내 업사이클링 시장 규모
              </h3>
              <p className="mt-1 mb-6 text-[12px]" style={{ color: MUTED }}>
                단위: 억원 · 업계 추정치
              </p>
              <div
                className="h-[260px]"
                role="img"
                aria-label="국내 업사이클링 시장 규모 추이 차트. 2018년 34억원에서 2025년 210억원으로 꾸준히 성장했습니다."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={marketGrowth} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="landing-market-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={HAIRLINE} vertical={false} />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: MUTED, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: MUTED, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: HAIRLINE }} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={ACCENT}
                      strokeWidth={2}
                      fill="url(#landing-market-fill)"
                      activeDot={{ r: 5, fill: ACCENT, stroke: "#0f1f22", strokeWidth: 2 }}
                      isAnimationActive={!reduce}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.12} className="lg:col-span-2">
            <div
              className="rounded-3xl border p-8 h-full flex flex-col justify-between gap-8"
              style={{ borderColor: HAIRLINE, background: "rgba(249,247,242,0.04)" }}
            >
              <div>
                <h3 className="text-[15px] font-medium" style={{ color: INK }}>
                  국내 폐기물 재활용률
                </h3>
                <p className="mt-1 text-[12px]" style={{ color: MUTED }}>
                  환경부 통계 기반
                </p>
              </div>
              <div>
                <p
                  style={{
                    fontFamily: "'Black Han Sans', sans-serif",
                    fontSize: "clamp(48px, 5vw, 64px)",
                    color: INK,
                    lineHeight: 1,
                  }}
                >
                  <CountUp to={87} suffix="%" />
                </p>
                <div
                  className="mt-6 h-2 rounded-full overflow-hidden"
                  style={{ background: "rgba(249,247,242,0.12)" }}
                  role="img"
                  aria-label="국내 폐기물 재활용률 87퍼센트"
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: ACCENT }}
                    initial={reduce ? { width: "87%" } : { width: 0 }}
                    whileInView={{ width: "87%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <p className="mt-4 text-[13px] leading-relaxed" style={{ color: MUTED }}>
                  재활용을 넘어 새 가치를 더하는 다음 단계가 업사이클링입니다.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

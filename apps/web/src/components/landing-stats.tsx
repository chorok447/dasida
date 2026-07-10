"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { CountUp, ScrollReveal } from "@/components/scroll-reveal";

// recharts(+d3)는 랜딩 첫 JS 에서 제외하고 뷰포트 진입 시점에 로드한다(번들 최적화).
// 자리표시자는 컨테이너(h-[260px])가 잡고 있어 CLS 없음.
const LandingMarketChart = dynamic(() => import("@/components/landing-market-chart"), {
  ssr: false,
  loading: () => null,
});

const kpis = [
  { value: 12400, suffix: "+", label: "함께한 업사이클러" },
  { value: 38000, suffix: "+", label: "공유된 재탄생 이야기" },
  { value: 640, suffix: "+", label: "진행된 캠페인" },
];

const ACCENT = "#7dd3a3";
const INK = "#f9f7f2";
const MUTED = "rgba(249,247,242,0.6)";
const HAIRLINE = "rgba(249,247,242,0.08)";

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
                <LandingMarketChart />
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

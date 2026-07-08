"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Flag, PenLine, Share2 } from "lucide-react";
import { ScrollReveal } from "@/components/scroll-reveal";

const steps = [
  {
    icon: <PenLine size={26} />,
    title: "기록하다",
    desc: "버려질 뻔한 것의 변신을 사진과 이야기로 남기세요.",
  },
  {
    icon: <Share2 size={26} />,
    title: "나누다",
    desc: "피드에서 서로의 아이디어에 좋아요와 댓글로 응답하세요.",
  },
  {
    icon: <Flag size={26} />,
    title: "함께하다",
    desc: "캠페인에 참여하거나 직접 개최해 변화를 넓히세요.",
  },
];

export function LandingFlow() {
  const reduce = useReducedMotion();

  return (
    <section
      className="relative py-32 px-8 transition-colors"
      style={{ background: "var(--surface-muted)" }}
    >
      <div className="max-w-6xl mx-auto">
        <ScrollReveal className="text-center mb-20">
          <p
            className="tracking-[0.4em] uppercase mb-4"
            style={{ color: "var(--accent-secondary)" }}
          >
            How it works
          </p>
          <h2
            style={{
              fontFamily: "'Black Han Sans', sans-serif",
              fontSize: "clamp(40px, 5vw, 72px)",
              color: "var(--foreground)",
            }}
          >
            참여는 이렇게 시작됩니다
          </h2>
        </ScrollReveal>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          {steps.map((step, i) => (
            <li key={step.title} className="list-none">
              <ScrollReveal
                delay={i * 0.15}
                className="relative rounded-3xl border p-8 h-full"
                style={{
                  borderColor: "rgba(var(--ink-rgb), 0.12)",
                  background: "var(--card)",
                }}
              >
                <span
                  className="absolute top-6 right-7 text-[12px] tracking-[0.3em]"
                  style={{ color: "rgba(var(--ink-rgb), 0.4)" }}
                >
                  0{i + 1}
                </span>
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: "#7dd3a3", color: "#0f1f22" }}
                >
                  {step.icon}
                </div>
                <h3
                  style={{
                    fontFamily: "'Black Han Sans', sans-serif",
                    fontSize: 26,
                    color: "var(--heading)",
                  }}
                >
                  {step.title}
                </h3>
                <p
                  className="mt-3 leading-relaxed"
                  style={{ color: "rgba(var(--ink-rgb), 0.68)" }}
                >
                  {step.desc}
                </p>
              </ScrollReveal>
            </li>
          ))}
        </ol>

        <ScrollReveal className="text-center">
          <h3
            style={{
              fontFamily: "'Black Han Sans', sans-serif",
              fontSize: "clamp(28px, 3.5vw, 44px)",
              color: "var(--foreground)",
            }}
          >
            오늘, 당신의 다시가 시작됩니다
          </h3>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.div whileHover={reduce ? undefined : { y: -3 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/feed"
                className="inline-flex items-center justify-center rounded-full px-8 py-4 text-[15px] font-medium shadow-[0_16px_40px_-16px_rgba(125,211,163,0.8)]"
                style={{ background: "#7dd3a3", color: "#0f1f22" }}
              >
                피드 둘러보기
              </Link>
            </motion.div>
            <motion.div whileHover={reduce ? undefined : { y: -3 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/campaigns"
                className="inline-flex items-center justify-center rounded-full px-8 py-4 text-[15px] font-medium border"
                style={{
                  borderColor: "rgba(var(--ink-rgb), 0.4)",
                  color: "var(--heading)",
                }}
              >
                캠페인 참여하기
              </Link>
            </motion.div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

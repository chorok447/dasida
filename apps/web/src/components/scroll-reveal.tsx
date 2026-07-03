"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";

// 공용 easing. 페이지 전환/리빌/스태거가 같은 곡선을 쓴다.
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// 스크롤 진입 시 fade + rise. 랜딩/목록 공용 리빌 래퍼.
export function ScrollReveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

// 뷰포트 진입 시 0 → to 카운트업. reduced-motion이면 즉시 최종값.
export function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
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
      ease: EASE_OUT,
      onUpdate: (v) => {
        el.textContent = `${Math.round(v).toLocaleString()}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, to, suffix, reduce]);

  return <span ref={ref}>{`0${suffix}`}</span>;
}

// 목록 아이템 순차 등장. 마운트 시 1회 재생, 페이지네이션으로 리마운트되면 다시 재생.
export function StaggerItem({
  index,
  children,
  className,
}: {
  index: number;
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.48), ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

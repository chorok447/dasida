"use client";

import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/components/scroll-reveal";

// 라우트 이동 시 페이지 콘텐츠 fade + rise 진입. 헤더/푸터(layout)는 고정.
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

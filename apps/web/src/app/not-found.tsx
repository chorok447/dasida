"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Home } from "lucide-react";

export default function NotFound() {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 120, damping: 18 });
  const sy = useSpring(my, { stiffness: 120, damping: 18 });
  const rY = useTransform(sx, [-0.5, 0.5], [-25, 25]);
  const rX = useTransform(sy, [-0.5, 0.5], [18, -18]);

  return (
    <section
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      className="relative min-h-screen flex items-center justify-center overflow-hidden transition-colors"
      style={{
        position: "relative",
        perspective: 1400,
        backgroundImage: "var(--auth-gradient)",
      }}
    >
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <motion.div
        style={{ rotateX: rX, rotateY: rY, transformStyle: "preserve-3d" }}
        className="relative text-center"
      >
        <motion.div style={{ transform: "translateZ(120px)" }}>
          <span
            style={{
              fontFamily: "var(--font-black-han), sans-serif",
              fontSize: "clamp(160px, 22vw, 280px)",
              lineHeight: 1,
              backgroundImage: "linear-gradient(180deg,#7dd3a3,#3a7a5a)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              textShadow: "0 30px 60px rgba(0,0,0,0.3)",
            }}
          >
            404
          </span>
        </motion.div>
        <motion.p
          style={{
            transform: "translateZ(60px)",
            color: "rgba(var(--ink-rgb), 0.85)",
            fontFamily: "var(--font-black-han), sans-serif",
            fontSize: "clamp(24px, 3vw, 36px)",
          }}
          className="mt-4"
        >
          페이지를 찾을 수 없습니다
        </motion.p>
        <Link
          href="/"
          style={{ transform: "translateZ(90px)", background: "#7dd3a3", color: "#0f1f22" }}
          className="mt-10 inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-medium hover:-translate-y-0.5 transition-transform shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4)]"
        >
          <Home size={16} /> 메인페이지로 이동하기
        </Link>
      </motion.div>
    </section>
  );
}

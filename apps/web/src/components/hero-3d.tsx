"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { useTheme } from "@/lib/theme-context";

export function Hero3D() {
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const dark = theme === "dark";

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 120, damping: 18 });
  const sy = useSpring(my, { stiffness: 120, damping: 18 });
  const rotateY = useTransform(sx, [-0.5, 0.5], [-18, 18]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [14, -14]);

  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 800], ["0%", "40%"]);
  const titleY = useTransform(scrollY, [0, 800], ["0%", "-30%"]);
  const titleOpacity = useTransform(scrollY, [0, 600], [1, 0]);
  const blobY = useTransform(scrollY, [0, 800], ["0%", "60%"]);

  const [hover, setHover] = useState(false);

  function handleMove(e: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  return (
    <section
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        mx.set(0);
        my.set(0);
      }}
      className="relative w-full min-h-screen flex items-center justify-center overflow-hidden transition-colors"
      style={{
        position: "relative",
        perspective: 1400,
        backgroundImage: dark
          ? "linear-gradient(135deg,#0f1f22,#1c4044 45%,#2a5a4a)"
          : "linear-gradient(135deg,#f9f7f2,#e7dfcb 45%,#cfe6d3)",
      }}
    >
      <motion.div className="absolute inset-0 opacity-40" style={{ y: blobY }}>
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[120px]"
          style={{ background: dark ? "#7dd3a3" : "#7dd3a3" }}
        />
        <div
          className="absolute -bottom-40 -right-20 w-[700px] h-[700px] rounded-full blur-[140px]"
          style={{ background: dark ? "#e7dfcb" : "#1c4044", opacity: 0.4 }}
        />
      </motion.div>

      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ y: bgY }}
      >
        <div
          className="absolute top-1/4 left-10 w-40 h-40 rounded-full border"
          style={{ borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(28,64,68,0.2)" }}
        />
        <div
          className="absolute bottom-1/3 right-16 w-24 h-24 rounded-full border"
          style={{ borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(28,64,68,0.2)" }}
        />
      </motion.div>

      <motion.div
        className="relative"
        style={{ rotateX, rotateY, y: titleY, opacity: titleOpacity, transformStyle: "preserve-3d" }}
      >
        <motion.div
          style={{ transform: "translateZ(40px)" }}
          className="absolute -top-16 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full border backdrop-blur-md whitespace-nowrap tracking-[0.3em] uppercase"
        >
          <span
            style={{
              color: dark ? "rgba(255,255,255,0.9)" : "rgba(15,31,34,0.85)",
            }}
          >
            Re · Cycle · Up
          </span>
        </motion.div>

        <motion.h1
          style={{ transform: "translateZ(90px)" }}
          className="text-center px-10 py-12 select-none"
        >
          <span
            className="block"
            style={{
              fontFamily: "'Black Han Sans', sans-serif",
              fontSize: "clamp(48px, 7vw, 110px)",
              lineHeight: 1.05,
              color: dark ? "#f9f7f2" : "#0f1f22",
              textShadow: dark ? "0 20px 60px rgba(0,0,0,0.45)" : "0 20px 60px rgba(28,64,68,0.2)",
            }}
          >
            당 신 은 지 구 를 위해
          </span>
          <span
            className="block mt-3"
            style={{
              fontFamily: "'Black Han Sans', sans-serif",
              fontSize: "clamp(48px, 7vw, 110px)",
              lineHeight: 1.05,
              backgroundImage: dark
                ? "linear-gradient(90deg,#d8e8c3,#7dd3a3,#e7dfcb)"
                : "linear-gradient(90deg,#1c4044,#3a7a5a,#1c4044)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            어떤 노력을 하고 있나요?
          </span>
        </motion.h1>

        <motion.div
          style={{ transform: "translateZ(140px)" }}
          className="absolute -right-10 -top-8 w-28 h-28 rounded-2xl bg-[#7dd3a3] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] flex items-center justify-center"
        >
          <span style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 28, color: "#0f1f22" }}>
            다시,<br />다
          </span>
        </motion.div>

        <motion.div
          style={{
            transform: "translateZ(120px)",
            borderColor: dark ? "rgba(231,223,203,0.7)" : "rgba(28,64,68,0.5)",
          }}
          className="absolute -left-16 -bottom-10 w-24 h-24 rounded-full border-4 backdrop-blur-md"
        />

        <motion.p
          style={{
            transform: "translateZ(60px)",
            color: dark ? "rgba(255,255,255,0.8)" : "rgba(15,31,34,0.7)",
          }}
          className="text-center mt-4 max-w-xl mx-auto"
        >
          마우스를 움직여 보세요 — 레이어들이 3D 공간에서 따라옵니다.
        </motion.p>
      </motion.div>

      <motion.div
        animate={{ y: hover ? 6 : 0, opacity: hover ? 0.4 : 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 tracking-[0.4em] uppercase"
        style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(15,31,34,0.6)" }}
      >
        scroll ↓
      </motion.div>
    </section>
  );
}

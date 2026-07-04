"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useTheme } from "@/lib/theme-context";
import { PageShell } from "@/components/page-shell";

const logos = [
  { kind: "wordmark", label: "다시,다", note: "WORDMARK · MAIN" },
  { kind: "compact", label: "다,다", note: "WORDMARK · SHORT" },
  { kind: "circle", label: "다", note: "MARK · CIRCLE" },
  { kind: "stack", label: "다시\n다", note: "WORDMARK · STACK" },
  { kind: "monogram", label: "DD", note: "MONOGRAM" },
  { kind: "leaf", label: "🌿", note: "ICON · LEAF" },
  { kind: "arrow", label: "↻", note: "ICON · LOOP" },
  { kind: "outline", label: "다시,다", note: "OUTLINE" },
] as const;

function LogoCard({ item, index }: { item: (typeof logos)[number]; index: number }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 200, damping: 20 });
  const sy = useSpring(my, { stiffness: 200, damping: 20 });
  const rY = useTransform(sx, [-0.5, 0.5], [-18, 18]);
  const rX = useTransform(sy, [-0.5, 0.5], [14, -14]);

  const palettes = [
    { bg: "#1c4044", fg: "#7dd3a3" },
    { bg: "#7dd3a3", fg: "#0f1f22" },
    { bg: "#e7dfcb", fg: "#1c4044" },
    { bg: "#0f1f22", fg: "#e7dfcb" },
    { bg: "#3a7a5a", fg: "#f9f7f2" },
    { bg: "#f9f7f2", fg: "#1c4044" },
    { bg: "#1c4044", fg: "#e7dfcb" },
    { bg: "#7dd3a3", fg: "#1c4044" },
  ];
  const p = palettes[index % palettes.length];
  const outline = item.kind === "outline";

  return (
    <div style={{ perspective: 1000 }}>
      <motion.div
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
        style={{
          rotateX: rX,
          rotateY: rY,
          transformStyle: "preserve-3d",
          background: outline ? "transparent" : p.bg,
          borderColor: outline ? (dark ? "rgba(255,255,255,0.3)" : "rgba(28,64,68,0.3)") : "transparent",
        }}
        className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-3xl border-2 p-6 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)]"
      >
        <div
          style={{
            transform: "translateZ(50px)",
            fontFamily: "'Black Han Sans', sans-serif",
            fontSize:
              item.kind === "monogram"
                ? 86
                : item.kind === "leaf" || item.kind === "arrow"
                  ? 110
                  : item.kind === "circle"
                    ? 100
                    : item.kind === "compact"
                      ? 64
                      : 56,
            lineHeight: 1,
            color: outline ? (dark ? "#7dd3a3" : "#1c4044") : p.fg,
            whiteSpace: "pre-line",
            textAlign: "center",
          }}
        >
          {item.label}
        </div>
        <div
          style={{
            transform: "translateZ(20px)",
            color: outline ? (dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)") : p.fg,
            opacity: 0.7,
          }}
          className="absolute bottom-4 left-0 right-0 text-center text-[10px] tracking-[0.3em]"
        >
          {item.note}
        </div>
      </motion.div>
    </div>
  );
}

export default function LogosClient() {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <PageShell orb="center">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <p
            className="mb-3 text-[11px] uppercase tracking-[0.4em]"
            style={{ color: dark ? "#7dd3a3" : "#1c4044" }}
          >
            Brand Identity
          </p>
          <h1
            style={{
              fontFamily: "'Black Han Sans', sans-serif",
              fontSize: "clamp(40px, 5vw, 72px)",
              color: dark ? "#f9f7f2" : "#0f1f22",
            }}
          >
            로고 후보들
          </h1>
          <p className="mx-auto mt-4 max-w-xl" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
            마우스를 올려 각 로고를 3D 공간에서 확인해 보세요.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {logos.map((l, i) => (
            <LogoCard key={l.kind} item={l} index={i} />
          ))}
        </div>
      </div>
    </PageShell>
  );
}

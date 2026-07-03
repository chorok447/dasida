"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { Leaf, Recycle, Sprout, Shirt, Coffee, Package } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

type Card = {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tone: string;
};

const cards: Card[] = [
  { icon: <Recycle size={28} />, title: "폐자원 재발견", desc: "버려진 자원에 새 가치를 부여합니다.", tone: "from-[#1c4044] to-[#2a5a4a]" },
  { icon: <Shirt size={28} />, title: "패션 업사이클", desc: "런웨이에 오른 업사이클링 의류.", tone: "from-[#3a5a3a] to-[#7dd3a3]" },
  { icon: <Coffee size={28} />, title: "푸드 업사이클", desc: "버려질 식재료로 만드는 새로운 맛.", tone: "from-[#6a6558] to-[#a08c6a]" },
  { icon: <Sprout size={28} />, title: "도시 화분", desc: "플라스틱이 화분으로 다시 태어납니다.", tone: "from-[#2a5a4a] to-[#7dd3a3]" },
  { icon: <Package size={28} />, title: "패키지 순환", desc: "포장재를 줄이고 재사용 합니다.", tone: "from-[#1c4044] to-[#3a5a3a]" },
  { icon: <Leaf size={28} />, title: "그린 캠페인", desc: "함께 참여하고, 직접 개최하세요.", tone: "from-[#3a5a3a] to-[#1c4044]" },
];

function TiltCard({ card }: { card: Card }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 200, damping: 20 });
  const sy = useSpring(my, { stiffness: 200, damping: 20 });
  const rotateY = useTransform(sx, [-0.5, 0.5], [-22, 22]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [18, -18]);
  const glare = useTransform(() => {
    const x = 50 + sx.get() * 60;
    const y = 50 + sy.get() * 60;
    return `radial-gradient(400px circle at ${x}% ${y}%, rgba(255,255,255,0.35), transparent 50%)`;
  });

  const reduce = useReducedMotion();

  function onMove(e: React.MouseEvent) {
    if (reduce) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }

  return (
    <div style={{ perspective: 1000 }}>
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={() => {
          mx.set(0);
          my.set(0);
        }}
        whileHover={{ scale: 1.03 }}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className={`relative h-[280px] rounded-3xl bg-gradient-to-br ${card.tone} p-7 text-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] overflow-hidden cursor-pointer`}
      >
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: glare }}
        />
        <div style={{ transform: "translateZ(40px)" }} className="flex flex-col h-full justify-between relative">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            {card.icon}
          </div>
          <div>
            <h3 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 28 }}>{card.title}</h3>
            <p className="mt-2 text-white/80">{card.desc}</p>
          </div>
        </div>
        <div
          style={{ transform: "translateZ(80px)" }}
          className="absolute top-6 right-6 w-10 h-10 rounded-full border border-white/40 flex items-center justify-center text-white/80"
        >
          →
        </div>
      </motion.div>
    </div>
  );
}

export function TiltCardGrid() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const headerY = useTransform(scrollY, [400, 1600], ["80px", "-80px"]);
  const gridY = useTransform(scrollY, [400, 1600], ["40px", "-40px"]);

  return (
    <section
      ref={ref}
      className="relative py-32 px-8 transition-colors"
      style={{ position: "relative", background: dark ? "#f9f7f2" : "#ffffff" }}
    >
      <div className="max-w-6xl mx-auto">
        <motion.div className="mb-16 text-center" style={{ y: headerY }}>
          <p className="text-[#6a6558] tracking-[0.4em] uppercase mb-4">Upcycling Stories</p>
          <h2
            style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: "clamp(40px, 5vw, 72px)", color: "#1c4044" }}
          >
            다시, 다 — 새 가치를 더하다
          </h2>
          <p className="mt-6 text-[#6a6558] max-w-2xl mx-auto">
            카드 위에 마우스를 올리면 3D로 기울어집니다.
          </p>
        </motion.div>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          style={{ y: gridY }}
        >
          {cards.map((c) => (
            <TiltCard key={c.title} card={c} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

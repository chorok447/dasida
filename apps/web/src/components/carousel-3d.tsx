"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, animate } from "motion/react";
import { fashionPhotos, marketPhotos, naturePhotos, peoplePhotos, objectPhotos, workshopPhotos } from "@/data/photos";

const items = [
  { tag: "FASHION", title: "파리패션위크 런웨이 오른 업사이클링 원피스", img: fashionPhotos[0] },
  { tag: "RAIL", title: "코레일, 고객과 함께하는 업사이클링 캠페인 개최", img: peoplePhotos[1] },
  { tag: "FINANCE", title: "우리금융, 플라스틱 업사이클링 화분 키트 기부", img: naturePhotos[2] },
  { tag: "FOOD", title: "뚜레쥬르, 푸드 업사이클링 ‘착한 빵식 통밀 식빵’ 출시", img: marketPhotos[2] },
  { tag: "PUBLIC", title: "환경공단, 전직원 기증 청바지 수거 업사이클링 추진", img: fashionPhotos[3] },
  { tag: "URBAN", title: "성동구, 노숙인 ‘희망 화수분’ 폐화분 업사이클링", img: naturePhotos[5] },
  { tag: "MUSIC", title: "래코드 x 하이브, BTS 무대의상 업사이클 굿즈", img: fashionPhotos[6] },
  { tag: "OBJECT", title: "지속가능한 삶을 꿈꾸는 미래산업, 업사이클", img: objectPhotos[0] },
  { tag: "WORKSHOP", title: "주말마다 열리는 동네 공방 클래스", img: workshopPhotos[1] },
];

export function Carousel3D() {
  const rotation = useMotionValue(0);
  const [paused, setPaused] = useState(false);
  // 640px 미만에서는 반경·카드를 줄여 화면 밖 클리핑을 막는다.
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setSmall(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const radius = small ? 210 : 420;
  const cardW = small ? 180 : 260;
  const cardH = small ? 240 : 340;
  const step = 360 / items.length;

  const reduce = useReducedMotion();

  useEffect(() => {
    if (paused || reduce) return;
    const controls = animate(rotation, rotation.get() - 360, {
      duration: 40,
      ease: "linear",
      repeat: Infinity,
    });
    return () => controls.stop();
  }, [paused, rotation, reduce]);

  function onDrag(_: unknown, info: { delta: { x: number } }) {
    rotation.set(rotation.get() + info.delta.x * 0.4);
  }

  return (
    <section
      className="relative py-32 overflow-hidden transition-colors"
      style={{
        background: "var(--band-gradient)",
      }}
    >
      <div className="text-center mb-20 px-8">
        <p
          className="tracking-[0.4em] uppercase mb-4"
          style={{ color: "var(--accent-secondary)" }}
        >
          In the News
        </p>
        <h2
          style={{
            fontFamily: "'Black Han Sans', sans-serif",
            fontSize: "clamp(40px, 5vw, 72px)",
            color: "var(--foreground)",
          }}
        >
          업사이클링, 지금 일어나는 일
        </h2>
        <p
          className="mt-6 max-w-2xl mx-auto"
          style={{ color: "rgba(var(--ink-rgb), 0.6)" }}
        >
          드래그해서 회전시켜 보세요. 마우스를 올리면 자동 회전이 멈춥니다.
        </p>
      </div>

      <div
        className="relative mx-auto"
        style={{ perspective: 1600, height: small ? 330 : 460 }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDrag={onDrag}
          className="relative w-full h-full cursor-grab active:cursor-grabbing"
          style={{ transformStyle: "preserve-3d", rotateY: rotation, rotateX: -8 }}
        >
          {items.map((it, i) => {
            const angle = i * step;
            return (
              <div
                key={it.title}
                className="absolute top-1/2 left-1/2"
                style={{
                  width: cardW,
                  height: cardH,
                  marginLeft: -cardW / 2,
                  marginTop: -cardH / 2,
                  transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
                  transformStyle: "preserve-3d",
                }}
              >
                <div
                  className="relative w-full h-full rounded-2xl overflow-hidden shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] border border-white/20"
                  style={{
                    background: "var(--news-card-gradient)",
                  }}
                >
                  <Image
                    src={it.img}
                    alt={`${it.title} 캠페인 이미지`}
                    fill
                    sizes="260px"
                    className="object-cover"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f1f22]/90 via-[#0f1f22]/40 to-transparent" />
                  <div className="absolute inset-0 p-6 flex flex-col justify-between text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] tracking-[0.3em] px-2 py-1 rounded bg-white/20 backdrop-blur">
                        {it.tag}
                      </span>
                      <span className="text-[10px] opacity-60">0{i + 1}</span>
                    </div>
                    <div>
                      <div className="w-10 h-10 rounded-full bg-[#7dd3a3] text-[#0f1f22] flex items-center justify-center mb-4">
                        ◐
                      </div>
                      <h3
                        style={{
                          fontFamily: "'Black Han Sans', sans-serif",
                          fontSize: small ? 15 : 20,
                          lineHeight: 1.3,
                        }}
                      >
                        {it.title}
                      </h3>
                      <div className="flex items-center justify-between text-[11px] opacity-70 mt-3">
                        <span>2026 · UPCYCLE</span>
                        <span>→</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      <div className="text-center mt-16 px-8">
        <p
          className="max-w-xl mx-auto leading-relaxed"
          style={{ color: "rgba(var(--ink-rgb), 0.53)" }}
        >
          폐자원이 자산이라는 인식이 확산됨에 따라, 단순한 재활용과 달리 새로운 가치를 불어넣는 산업이
          주목받고 있습니다.
        </p>
      </div>
    </section>
  );
}

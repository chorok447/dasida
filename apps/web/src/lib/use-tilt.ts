"use client";

import { useRef } from "react";
import { useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

type TiltRange = [number, number];

/** 마우스 위치 기반 3D 틸트 회전값. rect 대비 커서 위치(-0.5~0.5)를 스프링으로 감싸 rotateX/rotateY에 매핑한다. */
export function useTilt(options: {
  stiffness: number;
  damping: number;
  rotateXRange: TiltRange;
  rotateYRange: TiltRange;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: options.stiffness, damping: options.damping });
  const sy = useSpring(my, { stiffness: options.stiffness, damping: options.damping });
  const rotateY = useTransform(sx, [-0.5, 0.5], options.rotateYRange);
  const rotateX = useTransform(sy, [-0.5, 0.5], options.rotateXRange);
  const reduce = useReducedMotion();

  function onMouseMove(e: React.MouseEvent) {
    if (reduce) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function reset() {
    mx.set(0);
    my.set(0);
  }

  return { ref, sx, sy, rotateX, rotateY, onMouseMove, reset };
}

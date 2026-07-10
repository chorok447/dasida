"use client";

import { useRef } from "react";

type SwipeXHandlers = {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
};

/**
 * 가로 스와이프 제스처. 터치 시작~끝의 가로 이동이 threshold 이상이고
 * 세로 이동보다 클 때만 발화한다(세로 스크롤과의 충돌 방지).
 * 반환 핸들러를 캐러셀 컨테이너에 스프레드해서 쓴다.
 */
export function useSwipeX(
  { onSwipeLeft, onSwipeRight, threshold = 48 }: {
    /** 손가락을 왼쪽으로 민 경우(다음 항목). */
    onSwipeLeft: () => void;
    /** 손가락을 오른쪽으로 민 경우(이전 항목). */
    onSwipeRight: () => void;
    threshold?: number;
  },
): SwipeXHandlers {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (e) => {
      const t = e.touches[0];
      start.current = t ? { x: t.clientX, y: t.clientY } : null;
    },
    onTouchEnd: (e) => {
      const from = start.current;
      start.current = null;
      const t = e.changedTouches[0];
      if (!from || !t) return;
      const dx = t.clientX - from.x;
      const dy = t.clientY - from.y;
      if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return;
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    },
  };
}

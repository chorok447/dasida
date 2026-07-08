"use client";

import { useEffect } from "react";
import { useAuthSession } from "@/lib/use-auth-session";
import { openDmSocket } from "@/lib/dm-ws";

/**
 * 로그인 동안 유지되는 배지 갱신용 WS 연결. 대화방 구독 없이 사용자 단위 이벤트만 받는다
 * (inbox → DM 배지, notification → 알림 배지 — dm-ws 가 전역 이벤트로 발행).
 * 메시지 화면이 여는 소켓과 중복 수신되어도 같은 count 라 무해하다.
 */
export function RealtimeUpdates() {
  const { sessionId } = useAuthSession();

  useEffect(() => {
    if (!sessionId) return;
    const socket = openDmSocket({ viewerId: null });
    return () => socket.close();
  }, [sessionId]);

  return null;
}

"use client";

import { useEffect, useRef } from "react";
import { registerDmHandlers, type DmWsHandlers } from "@/lib/dm-socket-shared";

export type { DmWsHandlers };

/** ref 로 최신 handlers 를 유지하며 전역 DM 소켓에 등록한다. enabled=false 면 연결하지 않는다. */
export function useDmSocket(handlers: DmWsHandlers, enabled = true) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!enabled) return;
    return registerDmHandlers(() => handlersRef.current);
  }, [enabled]);
}

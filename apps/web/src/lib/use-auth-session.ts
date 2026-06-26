"use client";

import { useSyncExternalStore } from "react";
import { getName, getToken, clearSession, AUTH_EVENT } from "./auth";

/**
 * localStorage 기반 로그인 세션 훅.
 * useSyncExternalStore 로 외부 스토어(localStorage)를 구독 → 이펙트 내 setState 없이
 * SSR-safe 하게 읽는다. 서버 스냅샷은 항상 로그아웃 상태라 hydration mismatch 가 없다.
 * 같은 탭의 로그인/로그아웃은 커스텀 이벤트(AUTH_EVENT), 다른 탭은 storage 이벤트로 반영.
 */
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(AUTH_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(AUTH_EVENT, callback);
  };
}

export function useAuthSession() {
  const token = useSyncExternalStore(subscribe, getToken, () => null);
  const name = useSyncExternalStore(subscribe, getName, () => null);

  return { isLoggedIn: !!token, name, logout: clearSession };
}

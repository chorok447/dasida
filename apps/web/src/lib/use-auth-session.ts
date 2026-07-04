"use client";

import { useSyncExternalStore } from "react";
import { getName, getSessionId, clearSession, AUTH_EVENT } from "./auth";
import { apiPost } from "./api";

/**
 * localStorage 세션 마커 기반 로그인 세션 훅. (JWT 자체는 httpOnly 쿠키에 있어 JS 접근 불가)
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

/** 서버 쿠키/denylist 정리 후 로컬 마커 제거. 쿠키 만료 응답을 기다린 뒤 clearSession 한다. */
async function logout() {
  try {
    await apiPost("/api/auth/logout", {});
  } catch {
    // 네트워크/401 이라도 로컬 UI는 로그아웃 상태로 맞춘다.
  }
  clearSession();
}

export function useAuthSession() {
  const sessionId = useSyncExternalStore(subscribe, getSessionId, () => null);
  const name = useSyncExternalStore(subscribe, getName, () => null);
  // 서버 스냅샷은 항상 비로그인이라 hydration 첫 렌더를 "로그아웃"으로 오인할 수 있다.
  // 클라이언트 값 반영 여부를 함께 노출한다. (false 동안은 로그인 여부 미확정)
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);

  return { sessionId, isLoggedIn: !!sessionId, name, hydrated, logout };
}

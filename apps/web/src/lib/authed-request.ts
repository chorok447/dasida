import type { MutableRefObject } from "react";
import { toast } from "sonner";
import { ApiError } from "./api";
import { clearSession, getSessionId } from "./auth";

export type RequestGuard = {
  isCurrent: () => boolean;
  cancel: () => void;
};

/** generationRef + session 토큰으로 stale 응답을 무시한다. */
export function beginAuthedRequest(
  generationRef: MutableRefObject<number>,
  sessionId: string | null,
): RequestGuard {
  const requestToken = sessionId;
  const generation = ++generationRef.current;
  let cancelled = false;
  return {
    isCurrent: () =>
      !cancelled && generation === generationRef.current && getSessionId() === requestToken,
    cancel: () => {
      cancelled = true;
    },
  };
}

// 여러 요청이 동시에 401 을 맞아도 안내는 한 번만 띄운다.
let lastExpiryToastAt = 0;

export function clearSessionIfUnauthorized(error: unknown, sessionId: string | null): boolean {
  if (!(error instanceof ApiError && error.status === 401 && sessionId)) return false;
  clearSession();
  // 로그인돼 있다고 알던 상태에서의 401 = 세션이 강제로 끝난 것(만료/무효화/정지).
  // 조용히 로그아웃 UI 로 바뀌면 영문을 알 수 없으므로 이유를 한 번 알려준다.
  const now = Date.now();
  if (now - lastExpiryToastAt > 5_000) {
    lastExpiryToastAt = now;
    toast.info("세션이 만료되어 로그아웃되었습니다. 다시 로그인해주세요.");
  }
  return true;
}

export function staleByIdentity<T extends { identity: string }>(
  stored: T,
  identity: string,
  loading: T,
): T {
  return stored.identity === identity ? stored : loading;
}

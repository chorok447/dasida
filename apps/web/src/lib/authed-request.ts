import type { MutableRefObject } from "react";
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

export function clearSessionIfUnauthorized(error: unknown, sessionId: string | null): boolean {
  if (!(error instanceof ApiError && error.status === 401 && sessionId)) return false;
  clearSession();
  return true;
}

export function staleByIdentity<T extends { identity: string }>(
  stored: T,
  identity: string,
  loading: T,
): T {
  return stored.identity === identity ? stored : loading;
}

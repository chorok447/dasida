"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, ApiError } from "./api";
import { clearSession } from "./auth";
import { useAuthSession } from "./use-auth-session";

export type AuthedRefresh = {
  /** 인증 상태 재조회가 진행 중인지. true 동안 상호작용 버튼을 비활성화해 stale 결과 경합을 막는다. */
  refreshing: boolean;
  /** 진행 중인 재조회 결과를 무효화. mutation 시작 직전에 호출해 늦게 도착한 GET이 결과를 덮어쓰지 않게 한다. */
  invalidatePending: () => void;
};

/**
 * 서버 컴포넌트는 토큰 없이 GET 하므로 likedByMe/joinedByMe 가 항상 false 로 내려온다.
 * 이 훅은 클라이언트에서 인증 token 변화를 구독해 사용자별 상태를 다시 동기화한다.
 *
 * - 로그인 상태로 마운트 → 토큰 포함 GET.
 * - 로그아웃(token→null) → public GET 으로 likedByMe/joinedByMe=false 반영.
 * - 다른 token 으로 변경 → 새 사용자 기준 재조회.
 * - 최초 마운트 + 비로그인 → 서버 렌더가 이미 public 이라 재조회 생략.
 * - seq(generation) ref 로 최신 요청만 apply, unmount/변경 후 도착분은 무시.
 * - 실패해도 서버 렌더 데이터를 fallback 으로 두고 loading 을 풀어준다.
 */
export function useAuthedRefresh<T>(path: string, apply: (data: T) => void): AuthedRefresh {
  const { token } = useAuthSession();
  // apply 를 deps 에 넣지 않기 위해 ref 로 안정화. ref 쓰기는 렌더 밖(effect)에서만.
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });

  // seq(generation): invalidatePending 과 effect 가 공유하는 "최신 요청" 토큰.
  const seqRef = useRef(0);
  const firstRef = useRef(true);
  const [refreshing, setRefreshing] = useState(false);

  const invalidatePending = useCallback(() => {
    seqRef.current++; // 진행 중 요청의 seq 와 어긋나게 만들어 apply 차단
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const wasFirst = firstRef.current;
    firstRef.current = false;
    // 최초 마운트면서 비로그인: 서버 렌더 public 데이터 그대로 사용.
    if (wasFirst && !token) return;

    let cancelled = false; // path/token 변경·unmount 시 이 요청을 무효화(로컬 플래그)
    const seq = ++seqRef.current;
    // 최신 요청(seq 일치)이고 아직 유효(!cancelled)할 때만 반영.
    const isLatest = () => !cancelled && seq === seqRef.current;
    setRefreshing(true);
    apiGet<T>(path)
      .then((d) => {
        if (isLatest()) applyRef.current(d);
      })
      .catch((e) => {
        // 깨진/만료 토큰으로 인한 401 은 세션 정리(=로그아웃)로 일관 처리. alert 없이 조용히.
        if (e instanceof ApiError && e.status === 401) clearSession();
      })
      .finally(() => {
        if (isLatest()) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, token]);

  return { refreshing, invalidatePending };
}

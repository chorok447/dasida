"use client";

import { useEffect, useRef, useState } from "react";
import { getSessionId } from "./auth";
import { fetchNotificationUnreadCount, NOTIF_EVENT, type NotifChangedDetail } from "@/data/notifications";
import { DM_EVENT, fetchDmUnreadCount, type DmChangedDetail } from "@/data/messages";

// 헤더/모바일 하단 네비가 공유하는 미읽음 배지 훅.
// 이벤트 detail 에 count 가 실려 오면(WS push) 재조회 없이 반영하고, 없으면 재조회한다.
// 늦은 응답/토큰 변경은 generation + token 가드로 무시. 실패 시 배지만 숨긴다. polling 은 하지 않는다.

type UnreadState = { token: string | null; count: number };

function useUnreadCount(
  token: string | null,
  eventName: string,
  fetchCount: () => Promise<number>,
  detailCount: (event: Event | undefined) => number | undefined,
): number {
  const [state, setState] = useState<UnreadState>({ token: null, count: 0 });
  const generationRef = useRef(0);

  useEffect(() => {
    if (!token) return;
    const requestToken = token;
    const refresh = (event?: Event) => {
      const pushed = detailCount(event);
      if (typeof pushed === "number") {
        if (getSessionId() === requestToken) setState({ token: requestToken, count: pushed });
        return;
      }
      const generation = ++generationRef.current;
      fetchCount()
        .then((count) => {
          if (generation === generationRef.current && getSessionId() === requestToken) {
            setState({ token: requestToken, count });
          }
        })
        .catch(() => {
          if (generation === generationRef.current && getSessionId() === requestToken) {
            setState({ token: requestToken, count: 0 });
          }
        });
    };
    refresh();
    window.addEventListener(eventName, refresh);
    return () => window.removeEventListener(eventName, refresh);
    // fetchCount/detailCount 는 모듈 수준 함수만 넘긴다(아래 훅들) — 의존성에서 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, eventName]);

  return state.token === token ? state.count : 0;
}

const fetchNotifCount = () => fetchNotificationUnreadCount().then((res) => res.unreadCount);
const notifDetail = (event: Event | undefined) =>
  (event as CustomEvent<NotifChangedDetail> | undefined)?.detail?.unreadCount;

const fetchDmCount = () => fetchDmUnreadCount().then((res) => res.unreadCount);
const dmDetail = (event: Event | undefined) =>
  (event as CustomEvent<DmChangedDetail> | undefined)?.detail?.totalUnread;

export function useNotificationUnread(token: string | null): number {
  return useUnreadCount(token, NOTIF_EVENT, fetchNotifCount, notifDetail);
}

export function useDmUnread(token: string | null): number {
  return useUnreadCount(token, DM_EVENT, fetchDmCount, dmDetail);
}

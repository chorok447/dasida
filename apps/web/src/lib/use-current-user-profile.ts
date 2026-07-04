"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, ApiError } from "./api";
import { clearSession, getToken, PROFILE_EVENT } from "./auth";
import { useAuthSession } from "./use-auth-session";
import type { UserProfile } from "@/data/users";

type ProfileStatus = "idle" | "loading" | "success" | "error";

type ProfileState = {
  identity: string | null;
  profile: UserProfile | null;
  status: ProfileStatus;
  error: string;
};

export function useCurrentUserProfile() {
  const { token, hydrated } = useAuthSession();
  const [reloadTick, setReloadTick] = useState(0);
  const [state, setState] = useState<ProfileState>(() => ({
    identity: token,
    profile: null,
    status: token ? "loading" : "idle",
    error: "",
  }));
  const generationRef = useRef(0);

  // identity가 바뀌면 이전 사용자의 프로필을 네트워크 응답보다 먼저 제거한다.
  if (state.identity !== token) {
    setState({
      identity: token,
      profile: null,
      status: token ? "loading" : "idle",
      error: "",
    });
  }

  useEffect(() => {
    if (!token) return;

    const requestToken = token;
    const generation = ++generationRef.current;
    let cancelled = false;
    const isCurrent = () =>
      !cancelled && generation === generationRef.current && getToken() === requestToken;

    apiGet<UserProfile>("/api/auth/me")
      .then((profile) => {
        if (!isCurrent()) return;
        setState((current) =>
          current.identity === requestToken
            ? { ...current, profile, status: "success", error: "" }
            : current,
        );
      })
      .catch((error) => {
        if (!isCurrent()) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          return;
        }
        setState((current) =>
          current.identity === requestToken
            ? {
                ...current,
                profile: null,
                status: "error",
                error: "사용자 정보를 불러오지 못했습니다.",
              }
            : current,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [reloadTick, token]);

  useEffect(() => {
    const refresh = () => setReloadTick((tick) => tick + 1);
    window.addEventListener(PROFILE_EVENT, refresh);
    return () => window.removeEventListener(PROFILE_EVENT, refresh);
  }, []);

  const retry = () => {
    if (!token) return;
    setState((current) => ({ ...current, profile: null, status: "loading", error: "" }));
    setReloadTick((tick) => tick + 1);
  };

  return {
    profile: state.profile,
    // hydration 전에는 로그인 여부가 미확정이므로 loading으로 취급해 비로그인 UI 깜빡임을 막는다.
    loading: !hydrated || (!!token && state.status === "loading"),
    error: state.error,
    isLoggedIn: !!token,
    retry,
    refresh: retry,
  };
}

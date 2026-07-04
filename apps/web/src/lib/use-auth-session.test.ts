import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSession } from "./auth";
import { useAuthSession } from "./use-auth-session";

// logout 은 서버 쿠키/denylist 정리를 위해 POST /api/auth/logout 을 fire-and-forget 호출한다.
vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, apiPost: vi.fn().mockResolvedValue({ loggedOut: true }) };
});

import { apiPost } from "./api";

describe("useAuthSession", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("세션 마커가 없으면 비로그인 상태다", () => {
    const { result } = renderHook(() => useAuthSession());
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.name).toBeNull();
    // 클라이언트 전용 렌더에서는 즉시 확정 상태. (!hydrated 프레임은 SSR hydration에서만 발생)
    expect(result.current.hydrated).toBe(true);
  });

  it("setSession 하면 같은 탭에서 즉시 로그인 상태로 반영된다", () => {
    const { result } = renderHook(() => useAuthSession());
    act(() => setSession("홍길동"));
    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.sessionId).toBeTruthy();
    expect(result.current.name).toBe("홍길동");
  });

  it("setSession 을 다시 하면 세션 식별자가 바뀐다 (재로그인 감지)", () => {
    const { result } = renderHook(() => useAuthSession());
    act(() => setSession("홍길동"));
    const first = result.current.sessionId;
    act(() => setSession("홍길동"));
    expect(result.current.sessionId).not.toBe(first);
  });

  it("logout 하면 로컬 마커가 지워지고 서버 로그아웃을 호출한다", () => {
    setSession("홍길동");
    const { result } = renderHook(() => useAuthSession());
    expect(result.current.isLoggedIn).toBe(true);

    act(() => result.current.logout());
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.name).toBeNull();
    expect(localStorage.getItem("dasida.session")).toBeNull();
    expect(apiPost).toHaveBeenCalledWith("/api/auth/logout", {});
  });
});

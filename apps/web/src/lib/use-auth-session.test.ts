import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { setSession } from "./auth";
import { useAuthSession } from "./use-auth-session";

describe("useAuthSession", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("토큰이 없으면 비로그인 상태다", () => {
    const { result } = renderHook(() => useAuthSession());
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.name).toBeNull();
    // 클라이언트 전용 렌더에서는 즉시 확정 상태. (!hydrated 프레임은 SSR hydration에서만 발생)
    expect(result.current.hydrated).toBe(true);
  });

  it("setSession 하면 같은 탭에서 즉시 로그인 상태로 반영된다", () => {
    const { result } = renderHook(() => useAuthSession());
    act(() => setSession("jwt-1", "홍길동"));
    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.token).toBe("jwt-1");
    expect(result.current.name).toBe("홍길동");
  });

  it("logout 하면 세션이 비워지고 localStorage도 정리된다", () => {
    setSession("jwt-1", "홍길동");
    const { result } = renderHook(() => useAuthSession());
    expect(result.current.isLoggedIn).toBe(true);

    act(() => result.current.logout());
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.name).toBeNull();
    expect(localStorage.getItem("dasida.token")).toBeNull();
  });
});

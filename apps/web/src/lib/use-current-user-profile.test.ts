import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSession, clearSession } from "./auth";
import type { UserProfile } from "@/data/users";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, apiGet: vi.fn() };
});

import { apiGet } from "./api";
import { ApiError } from "./api";
import { useCurrentUserProfile } from "./use-current-user-profile";

const apiGetMock = vi.mocked(apiGet);

const PROFILE: UserProfile = {
  id: 1,
  email: "user@dasida.test",
  name: "홍길동",
  verified: true,
  profileImageUrl: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useCurrentUserProfile", () => {
  beforeEach(() => {
    localStorage.clear();
    apiGetMock.mockReset();
  });

  it("비로그인이면 프로필을 요청하지 않는다", () => {
    const { result } = renderHook(() => useCurrentUserProfile());
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.profile).toBeNull();
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it("로그인 상태면 loading 후 프로필을 불러온다", async () => {
    setSession("홍길동");
    const { promise, resolve } = deferred<UserProfile>();
    apiGetMock.mockReturnValue(promise);

    const { result } = renderHook(() => useCurrentUserProfile());
    expect(result.current.loading).toBe(true);
    expect(result.current.profile).toBeNull();

    await act(async () => resolve(PROFILE));
    expect(result.current.loading).toBe(false);
    expect(result.current.profile).toEqual(PROFILE);
    expect(apiGetMock).toHaveBeenCalledWith("/api/auth/me");
  });

  it("401 응답이면 세션을 비운다", async () => {
    setSession("홍길동");
    apiGetMock.mockRejectedValue(new ApiError(401, "/api/auth/me"));

    const { result } = renderHook(() => useCurrentUserProfile());
    await waitFor(() => expect(result.current.isLoggedIn).toBe(false));
    expect(result.current.profile).toBeNull();
    expect(localStorage.getItem("dasida.session")).toBeNull();
  });

  it("401 외 오류는 세션을 유지하고 에러 메시지를 노출한다", async () => {
    setSession("홍길동");
    apiGetMock.mockRejectedValue(new ApiError(500, "/api/auth/me"));

    const { result } = renderHook(() => useCurrentUserProfile());
    await waitFor(() => expect(result.current.error).not.toBe(""));
    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.profile).toBeNull();
  });

  it("응답 도착 전에 로그아웃하면 늦은 응답을 무시한다", async () => {
    setSession("홍길동");
    const { promise, resolve } = deferred<UserProfile>();
    apiGetMock.mockReturnValue(promise);

    const { result } = renderHook(() => useCurrentUserProfile());
    act(() => clearSession());

    await act(async () => resolve(PROFILE));
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.profile).toBeNull();
  });
});

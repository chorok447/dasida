import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, apiGet } from "./api";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function urlOf(input: unknown): string {
  return String(input);
}

describe("apiFetch 401 refresh 재시도", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("401 이면 refresh 성공 후 원 요청을 1회 재시도한다", async () => {
    let dataCalls = 0;
    fetchMock.mockImplementation((input: unknown) => {
      const url = urlOf(input);
      if (url.includes("/api/auth/refresh")) return Promise.resolve(jsonResponse(200));
      dataCalls += 1;
      return Promise.resolve(dataCalls === 1 ? jsonResponse(401) : jsonResponse(200, { ok: true }));
    });

    await expect(apiGet<{ ok: boolean }>("/api/posts/mine")).resolves.toEqual({ ok: true });
    const urls = fetchMock.mock.calls.map((call) => urlOf(call[0]));
    expect(urls.filter((u) => u.includes("/api/auth/refresh"))).toHaveLength(1);
    expect(urls.filter((u) => u.includes("/api/posts/mine"))).toHaveLength(2);
  });

  it("refresh 실패면 재시도 없이 원래 401 을 던진다", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = urlOf(input);
      if (url.includes("/api/auth/refresh")) return Promise.resolve(jsonResponse(401));
      return Promise.resolve(jsonResponse(401));
    });

    await expect(apiGet("/api/posts/mine")).rejects.toMatchObject({ status: 401 });
    await expect(apiGet("/api/posts/mine")).rejects.toBeInstanceOf(ApiError);
    const urls = fetchMock.mock.calls.map((call) => urlOf(call[0]));
    expect(urls.filter((u) => u.includes("/api/posts/mine"))).toHaveLength(2); // 재시도 없음(호출 2회 = 테스트 2회)
  });

  it("로그인 401(자격 증명 오류)은 refresh 를 시도하지 않는다", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401));

    const res = await apiFetch("/api/auth/login", { method: "POST" });
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("동시 401 이어도 refresh 는 한 번만 나간다(single-flight)", async () => {
    let refreshCalls = 0;
    const dataCalls = new Map<string, number>();
    fetchMock.mockImplementation((input: unknown) => {
      const url = urlOf(input);
      if (url.includes("/api/auth/refresh")) {
        refreshCalls += 1;
        return Promise.resolve(jsonResponse(200));
      }
      const count = (dataCalls.get(url) ?? 0) + 1;
      dataCalls.set(url, count);
      return Promise.resolve(count === 1 ? jsonResponse(401) : jsonResponse(200, { ok: true }));
    });

    await Promise.all([apiGet("/api/notifications"), apiGet("/api/posts/bookmarks")]);
    expect(refreshCalls).toBe(1);
  });
});

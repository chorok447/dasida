import { getToken } from "./auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

/** API 실패를 status 기반으로 분기할 수 있게 하는 에러. 호출부는 `e instanceof ApiError && e.status === 401` 로 처리. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public path: string,
    message?: string,
    public body?: unknown,
  ) {
    super(message ?? `API ${path} failed with ${status}`);
    this.name = "ApiError";
  }
}

/** 토큰이 있으면 Authorization 헤더. 서버 컴포넌트에서는 getToken()=null 이라 자동으로 비공개 GET 처리. */
function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** JSON 응답이면 파싱, 아니거나 비어있으면 undefined. (ponytail: 과하게 복잡하게 안 함) */
async function parseBody(res: Response): Promise<unknown> {
  if (!(res.headers.get("content-type") ?? "").includes("application/json")) return undefined;
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

/** 백엔드 GET 호출. 토큰이 있으면 부착(사용자별 상태 계산용). 실패 시 ApiError. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 404 등 not-found는 null, 그 외 오류는 ApiError. */
export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 백엔드 POST 호출(JSON). 로그인 토큰이 있으면 Authorization 헤더 부착. 실패 시 ApiError. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 백엔드 PUT 호출(JSON). 로그인 토큰이 있으면 Authorization 헤더 부착. 실패 시 ApiError. */
export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 백엔드 DELETE 호출. 로그인 토큰 부착. 실패 시 ApiError. */
export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 본문 없는 DELETE(204). apiDelete<T>는 JSON 파싱을 기대하므로 204 응답엔 이 헬퍼를 쓴다. */
export async function apiDeleteVoid(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
}

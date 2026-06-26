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

/** JSON 응답이면 파싱, 아니거나 비어있으면 undefined. (ponytail: 과하게 복잡하게 안 함) */
async function parseBody(res: Response): Promise<unknown> {
  if (!(res.headers.get("content-type") ?? "").includes("application/json")) return undefined;
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

/** 백엔드 GET 호출. 실패 시 ApiError. (ponytail: native fetch, 새 의존성 없음) */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 404 등 not-found는 null, 그 외 오류는 ApiError. */
export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 백엔드 POST 호출(JSON). 로그인 토큰이 있으면 Authorization 헤더 부착. 실패 시 ApiError. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

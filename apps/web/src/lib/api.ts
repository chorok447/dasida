import { getClientApiBaseUrl, getServerApiBaseUrl } from "./api-url";

function getApiBaseUrl(): string {
  return typeof window === "undefined" ? getServerApiBaseUrl() : getClientApiBaseUrl();
}

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

export function apiErrorMessage(error: ApiError, fallback: string): string {
  if (!error.body || typeof error.body !== "object") return fallback;
  const body = error.body as { detail?: unknown; message?: unknown };
  const message = typeof body.detail === "string" ? body.detail : body.message;
  return typeof message === "string" && message.trim() ? message : fallback;
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

// 인증은 httpOnly 쿠키(dasida_token)로 전달된다 → 모든 요청에 credentials: "include".
// 서버 컴포넌트 fetch 에는 브라우저 쿠키가 없어 자동으로 비로그인 GET 이 된다(공개 GET 만 SSR 에서 호출).

/** 백엔드 GET 호출. 로그인 쿠키가 있으면 사용자별 상태가 계산된다. 실패 시 ApiError. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 404 등 not-found는 null, 그 외 오류는 ApiError. */
export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, { credentials: "include", cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 백엔드 POST 호출(JSON). 실패 시 ApiError. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 백엔드 PUT 호출(JSON). 실패 시 ApiError. */
export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 백엔드 DELETE 호출. 실패 시 ApiError. */
export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** JSON body가 필요한 DELETE 호출. 계정 탈퇴처럼 민감값을 query string에 노출하지 않는다. */
export async function apiDeleteWithBody<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 본문 없는 DELETE(204). apiDelete<T>는 JSON 파싱을 기대하므로 204 응답엔 이 헬퍼를 쓴다. */
export async function apiDeleteVoid(path: string): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
}

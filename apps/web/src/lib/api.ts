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

// 401 이어도 refresh 를 시도하지 않는 경로. refresh 자신은 무한 재귀 방지,
// 로그인/가입의 401 은 "만료"가 아니라 "자격 증명 오류"라 재시도 의미가 없다.
const REFRESH_EXEMPT = ["/api/auth/refresh", "/api/auth/login", "/api/auth/signup"];

// 여러 요청이 동시에 401 을 맞아도 refresh 는 한 번만 나간다(single-flight).
let refreshInFlight: Promise<boolean> | null = null;

function tryRefreshToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * 모든 API 호출의 공통 fetch. access 토큰(30분)이 만료돼 401 이 오면 refresh 쿠키로
 * 재발급(rotation) 후 원 요청을 1회 재시도한다 — 로그인 유지가 refresh TTL(14일)까지 이어진다.
 * 서버 컴포넌트에는 브라우저 쿠키가 없으므로 재시도 없이 그대로 반환한다.
 * JSON 헬퍼 외의 요청(multipart 업로드 등)도 이 함수를 써야 같은 갱신 동작을 얻는다.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const request = () =>
    fetch(`${getApiBaseUrl()}${path}`, { credentials: "include", cache: "no-store", ...init });
  const res = await request();
  if (res.status !== 401 || typeof window === "undefined" || REFRESH_EXEMPT.includes(path)) {
    return res;
  }
  if (!(await tryRefreshToken())) return res;
  return request();
}

/** 백엔드 GET 호출. 로그인 쿠키가 있으면 사용자별 상태가 계산된다. 실패 시 ApiError. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 404 등 not-found는 null, 그 외 오류는 ApiError. */
export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  const res = await apiFetch(path);
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 백엔드 POST 호출(JSON). 실패 시 ApiError. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 백엔드 PUT 호출(JSON). 실패 시 ApiError. */
export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 백엔드 DELETE 호출. 실패 시 ApiError. */
export async function apiDelete<T>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** JSON body가 필요한 DELETE 호출. 계정 탈퇴처럼 민감값을 query string에 노출하지 않는다. */
export async function apiDeleteWithBody<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
  return res.json() as Promise<T>;
}

/** 본문 없는 DELETE(204). apiDelete<T>는 JSON 파싱을 기대하므로 204 응답엔 이 헬퍼를 쓴다. */
export async function apiDeleteVoid(path: string): Promise<void> {
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
}

/** 본문 없는 POST(204). */
export async function apiPostVoid(path: string): Promise<void> {
  const res = await apiFetch(path, { method: "POST" });
  if (!res.ok) throw new ApiError(res.status, path, undefined, await parseBody(res));
}

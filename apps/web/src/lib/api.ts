import { getToken } from "./auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

/** 백엔드 GET 호출. 실패 시 throw. (ponytail: native fetch, 새 의존성 없음) */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

/** 404 등 not-found는 null, 그 외 오류는 throw. */
export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

/** 백엔드 POST 호출(JSON). 로그인 토큰이 있으면 Authorization 헤더 부착. 실패 시 throw(메시지에 상태코드). */
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
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

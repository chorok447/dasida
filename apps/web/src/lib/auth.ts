// 클라이언트 세션. JWT를 localStorage에 보관. (ponytail: 서버 인증 쿠키는 SSR 보호가 필요해질 때)
const TOKEN_KEY = "dasida.token";
const NAME_KEY = "dasida.name";

// 같은 탭에서 세션 변경을 구독자(useAuthSession)에게 알리는 이벤트. storage 이벤트는 다른 탭만 발화하므로 보완용.
export const AUTH_EVENT = "dasida-auth";

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EVENT));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(NAME_KEY);
}

export function setSession(token: string, name: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(NAME_KEY, name);
  notify();
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
  notify();
}

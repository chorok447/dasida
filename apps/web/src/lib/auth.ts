// 클라이언트 세션 마커. JWT 는 httpOnly 쿠키(dasida_token)에만 있어 JS 에서 접근할 수 없다.
// localStorage 에는 "로그인돼 있음"을 나타내는 무의미한 세션 식별자와 표시 이름만 둔다.
// 식별자는 요청 staleness 가드(로그인/로그아웃/재로그인 감지)에 쓰이며, 값 자체에 의미는 없다.
const SESSION_KEY = "dasida.session";
const NAME_KEY = "dasida.name";
// 쿠키 전환 이전(JWT 를 localStorage 에 저장하던 시절) 키. 발견 시 정리한다.
const LEGACY_TOKEN_KEY = "dasida.token";

// 같은 탭에서 세션 변경을 구독자(useAuthSession)에게 알리는 이벤트. storage 이벤트는 다른 탭만 발화하므로 보완용.
export const AUTH_EVENT = "dasida-auth";
// 프로필 저장 후 useCurrentUserProfile 등이 /api/auth/me 를 다시 불러오도록 알린다.
export const PROFILE_EVENT = "dasida-profile";

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EVENT));
}

function newSessionId(): string {
  // non-secure context(http) 에서는 crypto.randomUUID 가 없을 수 있다.
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function getName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(NAME_KEY);
}

/** 로그인/회원가입/프로필 갱신 후 호출. 새 세션 식별자를 발급해 구독자들이 사용자 데이터를 다시 불러오게 한다. */
export function setSession(name: string) {
  localStorage.setItem(SESSION_KEY, newSessionId());
  localStorage.setItem(NAME_KEY, name);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  notify();
}

/** 로컬 세션 마커 제거. 서버 쿠키/denylist 정리는 useAuthSession.logout 이 담당한다(401 처리 등은 마커만 지우면 된다). */
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  notify();
}

export function notifyProfileUpdated() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROFILE_EVENT));
}

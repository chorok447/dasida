/**
 * 최근 검색어(localStorage) 저장소. useSyncExternalStore 로 구독한다 —
 * effect 내 동기 setState 없이(레포 lint 규칙) 기록/삭제가 칩 UI 에 반영되게 하기 위함.
 */

const KEY = "dasida_recent_searches";
const MAX_ITEMS = 8;

const EMPTY: string[] = [];
let cache: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return EMPTY;
  }
}

function write(next: string[]) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장 실패(사생활 보호 모드 등)여도 세션 내 메모리 목록은 유지한다.
  }
  listeners.forEach((listener) => listener());
}

/** getSnapshot 용 — 변경 전까지 같은 참조를 돌려준다. */
export function getRecentSearches(): string[] {
  if (cache === null) cache = typeof window === "undefined" ? EMPTY : read();
  return cache;
}

export function getServerRecentSearches(): string[] {
  return EMPTY;
}

export function subscribeRecentSearches(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 검색 실행 시 기록. 대소문자 무시 중복은 최신 표기로 갱신되며 맨 앞으로 온다. */
export function recordRecentSearch(query: string) {
  const normalized = query.trim();
  if (!normalized) return;
  const rest = getRecentSearches().filter((item) => item.toLowerCase() !== normalized.toLowerCase());
  write([normalized, ...rest].slice(0, MAX_ITEMS));
}

export function removeRecentSearch(query: string) {
  write(getRecentSearches().filter((item) => item !== query));
}

export function clearRecentSearches() {
  write([]);
}

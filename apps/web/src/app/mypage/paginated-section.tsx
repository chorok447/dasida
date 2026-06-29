"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { useTheme } from "@/lib/theme-context";

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

type Store<T> = {
  identity: string;
  token: string | null;
  status: "success" | "error" | "forbidden";
  data: PageResponse<T> | null;
};

function StatePanel({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div
      className="min-h-64 rounded-2xl border flex flex-col items-center justify-center gap-4 px-6 text-center"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
        color: dark ? "#f9f7f2" : "#0f1f22",
      }}
    >
      {children}
    </div>
  );
}

/**
 * 마이페이지 탭 공통 paginated 목록. token identity + generation 으로 stale 응답을 방어하고
 * token 이 바뀌면 이전 사용자 데이터를 즉시 감춘다(carry-over 는 같은 token 의 page 전환에서만).
 * 현재 page 가 비고 이전 page 가 있으면 자동으로 이전 page 로 이동한다.
 */
export function PaginatedSection<T>({
  identityKey,
  page,
  onPageChange,
  fetcher,
  renderItems,
  empty,
  loadingLabel,
  errorLabel,
}: {
  identityKey: string;
  page: number;
  onPageChange: (page: number) => void;
  fetcher: (page: number) => Promise<PageResponse<T>>;
  renderItems: (items: T[], reload: () => void) => ReactNode;
  empty: ReactNode;
  loadingLabel: string;
  errorLabel: string;
}) {
  const { token } = useAuthSession();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [retryTick, setRetryTick] = useState(0);
  const generationRef = useRef(0);
  // 부모가 매 렌더 새 함수를 넘겨도 fetch effect 가 재실행되지 않도록 ref 로 최신값을 보관한다.
  // (ref 갱신은 렌더가 아니라 effect 에서 — fetch effect 보다 먼저 정의돼 같은 commit 에서 선행한다.)
  const fetcherRef = useRef(fetcher);
  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => {
    fetcherRef.current = fetcher;
    onPageChangeRef.current = onPageChange;
  });

  const identity = JSON.stringify([identityKey, token, page, retryTick]);
  const [store, setStore] = useState<Store<T>>({ identity: "", token: null, status: "success", data: null });

  const reload = () => setRetryTick((tick) => tick + 1);

  useEffect(() => {
    if (!token) return;
    const requestToken = token;
    const generation = ++generationRef.current;
    let cancelled = false;
    const isCurrent = () => !cancelled && generation === generationRef.current && getToken() === requestToken;

    fetcherRef.current(page)
      .then((data) => {
        if (!isCurrent()) return;
        // 현재 page 가 비었고 이전 page 가 있으면 이전 page 로 이동(삭제/취소로 마지막 항목이 빠진 경우).
        if (data.content.length === 0 && data.page > 0) {
          onPageChangeRef.current(Math.max(0, data.page - 1));
          return;
        }
        setStore({ identity, token: requestToken, status: "success", data });
      })
      .catch((error) => {
        if (!isCurrent()) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          return;
        }
        if (error instanceof ApiError && error.status === 403) {
          setStore({ identity, token: requestToken, status: "forbidden", data: null });
          return;
        }
        // 오류 시 기존 목록을 지우지 않는다(같은 token 한정).
        setStore((current) => ({
          identity,
          token: requestToken,
          status: "error",
          data: current.token === requestToken ? current.data : null,
        }));
      });

    return () => {
      cancelled = true;
    };
    // identity 가 token·page·retry·identityKey 를 모두 포함한다. fetcher/onPageChange 는 ref 로 참조.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  const settled = store.identity === identity;
  const loading = !settled;
  const status = settled ? store.status : "loading";
  const data = store.token === token ? store.data : null; // token 교체 시 이전 사용자 목록 즉시 제거

  if (status === "forbidden") {
    return <StatePanel><p>접근 권한이 없습니다.</p></StatePanel>;
  }
  if (loading && !data) {
    return (
      <StatePanel>
        <RefreshCw size={26} className="animate-spin text-[#7dd3a3]" />
        <p>{loadingLabel}</p>
      </StatePanel>
    );
  }
  if (status === "error" && !data) {
    return (
      <StatePanel>
        <p>{errorLabel}</p>
        <button type="button" onClick={reload} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
          다시 시도
        </button>
      </StatePanel>
    );
  }
  if (data && data.totalElements === 0) {
    return <>{empty}</>;
  }
  if (!data) {
    return (
      <StatePanel>
        <RefreshCw size={26} className="animate-spin text-[#7dd3a3]" />
        <p>{loadingLabel}</p>
      </StatePanel>
    );
  }

  const fg = dark ? "#f9f7f2" : "#0f1f22";
  const subtle = dark ? "rgba(255,255,255,0.07)" : "rgba(28,64,68,0.07)";
  const currentPage = data.page + 1;
  const totalPages = Math.max(1, data.totalPages);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3" style={{ color: fg }}>
        <span className="text-[13px] opacity-70">총 {data.totalElements}개</span>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] disabled:opacity-45"
          style={{ background: subtle }}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> 새로고침
        </button>
      </div>

      {status === "error" ? (
        <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: "rgba(237,92,72,0.12)", color: dark ? "#f3b4ab" : "#b3402f" }}>
          {errorLabel}
        </div>
      ) : null}

      {renderItems(data.content, reload)}

      <div className="flex items-center justify-center gap-3" style={{ color: fg }}>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={loading || data.page <= 0}
          className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-35"
          style={{ background: subtle }}
        >
          <ChevronLeft size={14} /> 이전
        </button>
        <span className="text-[12px] opacity-65">{currentPage} / {totalPages} 페이지</span>
        <button
          type="button"
          onClick={() => onPageChange(data.page + 1)}
          disabled={loading || data.page + 1 >= data.totalPages}
          className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-35"
          style={{ background: "#7dd3a3", color: "#0f1f22" }}
        >
          다음 <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

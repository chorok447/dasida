"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Bell, MessageCircle, Users, CheckCheck, Check, Trash2 } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useAuthSession } from "@/lib/use-auth-session";
import { ApiError } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import {
  deleteNotification,
  deleteReadNotifications,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  relativeTime,
  type NotificationsResponse,
} from "@/data/notifications";

const PAGE_SIZE = 20;

const filters: { id: "all" | "unread"; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "unread", label: "안 읽음" },
];

function iconFor(type: string) {
  if (type === "CAMPAIGN_JOINED") return <Users size={16} />;
  if (type.endsWith("COMMENT_CREATED")) return <MessageCircle size={16} />;
  return <Bell size={16} />;
}

type Result = { identity: string; status: "success" | "error"; data: NotificationsResponse | null };

export default function NotificationsClient() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const router = useRouter();
  const { token, isLoggedIn } = useAuthSession();

  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const [result, setResult] = useState<Result>({ identity: "", status: "success", data: null });
  const [busy, setBusy] = useState(false); // 모두 읽음 in-flight (중복 클릭 방지)
  const [cleaningRead, setCleaningRead] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set()); // 개별 읽음 in-flight
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState("");

  const generationRef = useRef(0);

  // 요청 identity(토큰·페이지·필터·retry). 저장된 결과가 이 값과 다르면 아직 로딩 중으로 간주(동기 setState 회피).
  const requestIdentity = JSON.stringify([token, page, filter, retryTick]);

  // 비로그인은 로그인 페이지로(로그인 후 알림으로 복귀).
  useEffect(() => {
    if (!isLoggedIn) router.replace("/login?next=/notifications");
  }, [isLoggedIn, router]);

  // 검색 페이지와 동일한 stale 방어: generation + token 으로 늦은 응답이 최신을 덮지 못하게 한다.
  useEffect(() => {
    const requestToken = token;
    if (!requestToken || getToken() !== requestToken) return;
    const generation = ++generationRef.current;
    let cancelled = false;
    const isCurrent = () => !cancelled && generation === generationRef.current && getToken() === requestToken;

    fetchNotifications(page, PAGE_SIZE, filter === "unread")
      .then((res) => {
        if (!isCurrent()) return;
        if (res.content.length === 0 && page > 0) {
          setPage((currentPage) => Math.max(0, currentPage - 1));
          return;
        }
        setResult({ identity: requestIdentity, status: "success", data: res });
      })
      .catch((e) => {
        if (!isCurrent()) return;
        if (e instanceof ApiError && e.status === 401) {
          clearSession();
          router.replace("/login?next=/notifications");
          return;
        }
        setResult({ identity: requestIdentity, status: "error", data: null });
      });

    return () => {
      cancelled = true;
    };
  }, [requestIdentity, token, page, filter, router]);

  const current = result.identity === requestIdentity;
  const loading = !current;
  const error = current && result.status === "error";
  const data = current && result.status === "success" ? result.data : null;
  const list = data?.content ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const hasReadNotifications = filter === "all" && (data?.totalElements ?? 0) > unreadCount;

  const changeFilter = (next: "all" | "unread") => {
    if (next === filter) return;
    setActionError("");
    setPage(0);
    setFilter(next);
  };

  const markAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await markAllNotificationsRead();
      setRetryTick((t) => t + 1); // 목록·unreadCount 재조회
    } catch {
      /* 실패해도 화면 유지 — 다음 조회에서 정합 */
    } finally {
      setBusy(false);
    }
  };

  const markOne = async (id: string) => {
    if (pendingIds.has(id)) return;
    setPendingIds((s) => new Set(s).add(id));
    try {
      await markNotificationRead(id);
      setRetryTick((t) => t + 1);
    } catch {
      /* noop */
    } finally {
      setPendingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  const open = async (id: string, href: string, read: boolean) => {
    try {
      if (!read) await markNotificationRead(id);
    } catch {
      /* 읽음 실패해도 이동은 진행 */
    }
    router.push(href);
  };

  const removeOne = async (id: string) => {
    if (deletingIds.has(id)) return;
    const requestToken = token;
    if (!requestToken || getToken() !== requestToken) return;
    setDeletingIds((ids) => new Set(ids).add(id));
    setActionError("");
    try {
      await deleteNotification(id, requestToken);
      if (getToken() !== requestToken) return;
      if (list.length === 1 && page > 0) setPage((currentPage) => currentPage - 1);
      else setRetryTick((tick) => tick + 1);
    } catch (requestError) {
      if (getToken() !== requestToken) return;
      if (requestError instanceof ApiError && requestError.status === 401) {
        clearSession();
        router.replace("/login?next=/notifications");
      } else if (requestError instanceof ApiError && requestError.status === 404) {
        setActionError("이미 삭제되었거나 찾을 수 없는 알림입니다.");
        setRetryTick((tick) => tick + 1);
      } else if (requestError instanceof ApiError && requestError.status === 403) {
        setActionError("알림을 삭제할 권한이 없습니다.");
      } else {
        setActionError("알림 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setDeletingIds((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    }
  };

  const removeRead = async () => {
    if (cleaningRead || !hasReadNotifications) return;
    if (!window.confirm("읽은 알림을 모두 삭제할까요?\n삭제한 알림은 복구할 수 없습니다.")) return;
    const requestToken = token;
    if (!requestToken || getToken() !== requestToken) return;
    setCleaningRead(true);
    setActionError("");
    try {
      await deleteReadNotifications(requestToken);
      if (getToken() !== requestToken) return;
      if (page === 0) setRetryTick((tick) => tick + 1);
      else setPage(0);
    } catch (requestError) {
      if (getToken() !== requestToken) return;
      if (requestError instanceof ApiError && requestError.status === 401) {
        clearSession();
        router.replace("/login?next=/notifications");
      } else {
        setActionError("알림 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setCleaningRead(false);
    }
  };

  const cardBg = dark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)";
  const fg = dark ? "#f9f7f2" : "#0f1f22";

  if (!isLoggedIn) {
    return (
      <section className="min-h-screen flex items-center justify-center" style={{ color: fg }}>
        <p className="text-[14px] opacity-70">로그인 페이지로 이동합니다…</p>
      </section>
    );
  }

  return (
    <section
      className="relative min-h-screen pt-28 pb-20 px-4 sm:px-6 transition-colors overflow-hidden"
      style={{
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="max-w-3xl mx-auto relative">
        <div className="text-center mb-8">
          <p className="tracking-[0.4em] uppercase mb-3" style={{ color: dark ? "#7dd3a3" : "#1c4044", fontSize: 11 }}>
            Notifications
          </p>
          <h1
            style={{
              fontFamily: "'Black Han Sans', sans-serif",
              fontSize: "clamp(32px, 4.5vw, 54px)",
              color: fg,
            }}
          >
            알림{unreadCount > 0 ? ` (${unreadCount > 99 ? "99+" : unreadCount})` : ""}
          </h1>
        </div>

        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div
            className="flex gap-1 p-1 rounded-full"
            style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}
          >
            {filters.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => changeFilter(f.id)}
                  className="relative px-4 py-2 text-[13px] rounded-full"
                  style={{ color: active ? "#0f1f22" : dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}
                >
                  {active && (
                    <motion.div layoutId="notif-filter-pill" className="absolute inset-0 rounded-full" style={{ background: "#7dd3a3" }} />
                  )}
                  <span className="relative">{f.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={markAll}
              disabled={busy || cleaningRead || unreadCount === 0}
              className="flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-full transition-colors disabled:opacity-40"
              style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)", color: fg }}
            >
              <CheckCheck size={15} /> 모두 읽음
            </button>
            <button
              type="button"
              onClick={removeRead}
              disabled={cleaningRead || busy || !hasReadNotifications}
              className="flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-full transition-colors disabled:opacity-40"
              style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)", color: fg }}
            >
              <Trash2 size={14} /> {cleaningRead ? "정리 중…" : "읽은 알림 정리"}
            </button>
          </div>
        </div>

        {actionError ? <p role="alert" className="mb-4 text-[13px] text-[#ed5c48]">{actionError}</p> : null}

        {loading ? (
          <div className="py-20 text-center text-[14px] opacity-60" style={{ color: fg }}>
            불러오는 중…
          </div>
        ) : error ? (
          <div className="py-20 text-center" style={{ color: fg }}>
            <p className="text-[14px] mb-4 opacity-80">알림을 불러오지 못했습니다.</p>
            <button
              onClick={() => setRetryTick((t) => t + 1)}
              className="text-[13px] px-4 py-2 rounded-full font-medium"
              style={{ background: "#7dd3a3", color: "#0f1f22" }}
            >
              다시 시도
            </button>
          </div>
        ) : list.length === 0 ? (
          <div className="py-20 text-center text-[14px] opacity-60" style={{ color: fg }}>
            {filter === "unread" ? "안 읽은 알림이 없습니다." : "알림이 없습니다."}
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((n) => (
              <div
                key={n.id}
                className="flex items-center gap-3 p-4 rounded-2xl border transition-colors"
                style={{
                  background: n.read ? cardBg : dark ? "rgba(125,211,163,0.08)" : "rgba(125,211,163,0.12)",
                  borderColor: cardBorder,
                }}
              >
                <button
                  type="button"
                  onClick={() => open(n.id, n.href, n.read)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(20,138,144,0.14)", color: "#148a90" }}
                    >
                      {iconFor(n.type)}
                    </div>
                    {!n.read && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#7dd3a3]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] truncate" style={{ color: fg }}>{n.title}</div>
                    <div className="text-[12px] opacity-70 truncate" style={{ color: fg }}>{n.body}</div>
                  </div>
                  <span className="text-[11px] opacity-60 flex-shrink-0" style={{ color: fg }}>
                    {relativeTime(n)}
                  </span>
                </button>
                {!n.read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markOne(n.id);
                    }}
                    disabled={pendingIds.has(n.id)}
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40"
                    style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)", color: fg }}
                    aria-label="읽음 처리"
                  >
                    <Check size={15} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeOne(n.id);
                  }}
                  disabled={deletingIds.has(n.id) || pendingIds.has(n.id)}
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40"
                  style={{ background: dark ? "rgba(237,92,72,0.12)" : "rgba(237,92,72,0.08)", color: "#ed5c48" }}
                  aria-label="알림 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8" style={{ color: fg }}>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page <= 0}
              className="text-[13px] px-4 py-2 rounded-full disabled:opacity-40"
              style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}
            >
              이전
            </button>
            <span className="text-[13px] opacity-70">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
              disabled={page + 1 >= totalPages}
              className="text-[13px] px-4 py-2 rounded-full disabled:opacity-40"
              style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}
            >
              다음
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

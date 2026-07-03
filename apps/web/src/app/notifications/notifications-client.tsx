"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Bell, MessageCircle, Users, CheckCheck, Check, Trash2, Loader2 } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useAuthSession } from "@/lib/use-auth-session";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import { StaggerItem } from "@/components/scroll-reveal";
import { RecommendedCampaigns } from "@/components/recommended-campaigns";
import { ApiError } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import {
  deleteNotification,
  deleteReadNotifications,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  relativeTime,
  notificationTypeLabel,
  isNotificationNavigable,
  type NotificationItem,
  type NotificationsResponse,
} from "@/data/notifications";

const PAGE_SIZE = 20;

const filters: { id: "all" | "unread"; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "unread", label: "안 읽음" },
];

function iconFor(type: string) {
  if (type === "CAMPAIGN_JOINED") return <Users size={16} aria-hidden />;
  if (type.endsWith("COMMENT_CREATED")) return <MessageCircle size={16} aria-hidden />;
  return <Bell size={16} aria-hidden />;
}

function NotificationRow({
  item,
  dark,
  fg,
  cardBg,
  cardBorder,
  pending,
  deleting,
  onOpen,
  onMarkRead,
  onDelete,
}: {
  item: NotificationItem;
  dark: boolean;
  fg: string;
  cardBg: string;
  cardBorder: string;
  pending: boolean;
  deleting: boolean;
  onOpen: (item: NotificationItem) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const navigable = isNotificationNavigable(item.href);
  const timeLabel = relativeTime(item);
  const statusLabel = item.read ? "읽음" : "안 읽음";
  const rowStyle = {
    background: item.read ? cardBg : dark ? "rgba(125,211,163,0.08)" : "rgba(125,211,163,0.12)",
    borderColor: cardBorder,
  };
  const content = (
    <>
      <div className="relative flex-shrink-0">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "rgba(20,138,144,0.14)", color: "#148a90" }}
        >
          {iconFor(item.type)}
        </div>
        {!item.read && (
          <span
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#7dd3a3] ring-2 ring-[#0f1f22]/10"
            aria-hidden
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className="text-[14px] font-medium line-clamp-1"
            style={{ color: fg, opacity: item.read ? 0.72 : 1 }}
          >
            {item.title}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: item.read
                ? dark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(28,64,68,0.06)"
                : "rgba(125,211,163,0.22)",
              color: item.read ? (dark ? "rgba(255,255,255,0.55)" : "rgba(28,64,68,0.55)") : "#1c4044",
            }}
          >
            {statusLabel}
          </span>
        </div>
        <p
          className="mt-0.5 text-[12px] line-clamp-2"
          style={{ color: fg, opacity: item.read ? 0.55 : 0.75 }}
        >
          {item.body}
        </p>
        <p className="mt-1 text-[11px] opacity-60 sm:hidden" style={{ color: fg }}>
          {timeLabel} · {notificationTypeLabel(item.type)}
        </p>
      </div>
      <span className="hidden flex-shrink-0 text-[11px] opacity-60 sm:inline" style={{ color: fg }}>
        {timeLabel}
      </span>
    </>
  );

  return (
    <div
      className="flex items-stretch gap-2 rounded-2xl border p-3 sm:gap-3 sm:p-4 transition-[background-color,border-color,box-shadow] hover:shadow-md"
      style={rowStyle}
    >
      {navigable ? (
        <Link
          href={item.href}
          onClick={(event) => {
            if (!item.read) {
              event.preventDefault();
              onOpen(item);
            }
          }}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition-colors hover:bg-[#7dd3a3]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3a3] py-1"
          aria-label={`${item.title}, ${statusLabel}, ${timeLabel}`}
        >
          {content}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 py-1" role="group" aria-label={`${item.title}, ${statusLabel}`}>
          {content}
        </div>
      )}
      {!item.read && (
        <button
          type="button"
          onClick={() => onMarkRead(item.id)}
          disabled={pending || deleting}
          aria-busy={pending}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3a3]"
          style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)", color: fg }}
          aria-label="읽음으로 표시"
        >
          {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Check size={15} aria-hidden />}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        disabled={deleting || pending}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ed5c48]"
        style={{ background: dark ? "rgba(237,92,72,0.12)" : "rgba(237,92,72,0.08)", color: "#ed5c48" }}
        aria-label="알림 삭제"
      >
        {deleting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Trash2 size={14} aria-hidden />}
      </button>
    </div>
  );
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
  // isLoggedIn만 보면 직접 URL 진입 시 hydration 첫 렌더의 서버 스냅샷(비로그인)이 캡처되어
  // 로그인 상태에서도 튕기므로, localStorage의 실제 토큰을 함께 확인한다.
  useEffect(() => {
    if (!isLoggedIn && !getToken()) router.replace("/login?next=/notifications");
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
    setActionError("");
    try {
      await markAllNotificationsRead();
      setRetryTick((t) => t + 1);
      toast.success("모든 알림을 읽음 처리했습니다.");
    } catch {
      toast.error("읽음 처리에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const markOne = async (id: string) => {
    if (pendingIds.has(id)) return;
    setPendingIds((s) => new Set(s).add(id));
    setActionError("");
    try {
      await markNotificationRead(id);
      setRetryTick((t) => t + 1);
    } catch {
      toast.error("읽음 처리에 실패했습니다.");
    } finally {
      setPendingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  const open = async (item: NotificationItem) => {
    if (!isNotificationNavigable(item.href)) return;
    try {
      if (!item.read) await markNotificationRead(item.id);
    } catch {
      /* 읽음 실패해도 이동은 진행 */
    }
    router.push(item.href);
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
                  type="button"
                  onClick={() => changeFilter(f.id)}
                  aria-pressed={active}
                  className="relative px-4 py-2 text-[13px] rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3a3]"
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
              aria-busy={busy}
              className="flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-full transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3a3]"
              style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)", color: fg }}
            >
              {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <CheckCheck size={15} aria-hidden />}
              {busy ? "처리 중…" : "모두 읽음"}
            </button>
            <button
              type="button"
              onClick={removeRead}
              disabled={cleaningRead || busy || !hasReadNotifications}
              aria-busy={cleaningRead}
              className="flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-full transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3a3]"
              style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)", color: fg }}
            >
              <Trash2 size={14} aria-hidden /> {cleaningRead ? "정리 중…" : "읽은 알림 정리"}
            </button>
          </div>
        </div>

        {actionError ? <p role="alert" className="mb-4 text-[13px] text-[#ed5c48]">{actionError}</p> : null}

        {loading ? (
          <StatePanel compact>
            <Loader2 size={28} className="animate-spin text-[#7dd3a3]" aria-hidden />
            <p>알림을 불러오는 중입니다.</p>
          </StatePanel>
        ) : error ? (
          <StatePanel compact role="alert">
            <Bell size={28} className="opacity-40" aria-hidden />
            <p className="opacity-80">알림을 불러오지 못했습니다.</p>
            <button
              type="button"
              onClick={() => setRetryTick((t) => t + 1)}
              className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] font-medium text-[#0f1f22] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1f22]"
            >
              다시 시도
            </button>
          </StatePanel>
        ) : list.length === 0 ? (
          <div className="space-y-4">
            <StatePanel compact>
              <Bell size={32} className="opacity-35" aria-hidden />
              <p className="font-medium">
                {filter === "unread" ? "안 읽은 알림이 없습니다." : "알림이 없습니다."}
              </p>
              <p className="text-[12px] opacity-60">
                {filter === "unread"
                  ? "새 알림이 오면 이 목록에 표시됩니다."
                  : "관심 있는 캠페인에 참여하면 소식을 알림으로 받을 수 있어요."}
              </p>
            </StatePanel>
            {filter === "all" ? <RecommendedCampaigns heading="참여해볼 만한 캠페인" /> : null}
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((n, i) => (
              <StaggerItem key={n.id} index={i}>
                <NotificationRow
                  item={n}
                  dark={dark}
                  fg={fg}
                  cardBg={cardBg}
                  cardBorder={cardBorder}
                  pending={pendingIds.has(n.id)}
                  deleting={deletingIds.has(n.id)}
                  onOpen={open}
                  onMarkRead={markOne}
                  onDelete={removeOne}
                />
              </StaggerItem>
            ))}
          </div>
        )}

        {!loading && !error && totalPages > 1 ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalElements={data?.totalElements}
            compact
            className="mt-8"
            onPageChange={setPage}
          />
        ) : null}
      </div>
    </section>
  );
}

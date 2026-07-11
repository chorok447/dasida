"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Bell, CheckCheck, Trash2, Loader2 } from "lucide-react";
import { useAuthSession } from "@/lib/use-auth-session";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import { StaggerItem } from "@/components/scroll-reveal";
import { RecommendedCampaigns } from "@/components/recommended-campaigns";
import { PageShell } from "@/components/page-shell";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ApiError } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
import { beginAuthedRequest, clearSessionIfUnauthorized } from "@/lib/authed-request";
import {
  deleteNotification,
  deleteReadNotifications,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  isNotificationNavigable,
  type NotificationItem,
  type NotificationsResponse,
} from "@/data/notifications";
import { NotificationRow } from "./notification-row";

const PAGE_SIZE = 20;

type NotificationFilterId = "all" | "social" | "campaign" | "follow" | "message";

const FILTER_GROUP_TYPES: Partial<Record<NotificationFilterId, string[]>> = {
  social: ["POST_LIKED", "COMMENT_LIKED", "POST_COMMENT_CREATED", "CAMPAIGN_COMMENT_CREATED", "COMMENT_REPLY_CREATED", "COMMENT_MENTIONED"],
  campaign: ["CAMPAIGN_JOINED", "CAMPAIGN_PARTICIPATION_REMOVED", "CAMPAIGN_STATUS_CHANGED", "CAMPAIGN_PROOF_CREATED"],
  follow: ["USER_FOLLOWED"],
  message: ["MESSAGE_RECEIVED"],
};

const filters: { id: NotificationFilterId; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "social", label: "좋아요·댓글" },
  { id: "campaign", label: "캠페인" },
  { id: "follow", label: "팔로우" },
  { id: "message", label: "메시지" },
];

type Result = { identity: string; status: "success" | "error"; data: NotificationsResponse | null };

export default function NotificationsClient() {
  const router = useRouter();
  const { sessionId: token, isLoggedIn, hydrated } = useAuthSession();
  const confirm = useConfirm();

  const [filter, setFilter] = useState<NotificationFilterId>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const [result, setResult] = useState<Result>({ identity: "", status: "success", data: null });
  const [busy, setBusy] = useState(false); // 모두 읽음 in-flight (중복 클릭 방지)
  const [cleaningRead, setCleaningRead] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set()); // 개별 읽음 in-flight
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState("");

  const generationRef = useRef(0);

  // 요청 identity(토큰·페이지·필터·안읽음·retry). 저장된 결과가 이 값과 다르면 아직 로딩 중으로 간주(동기 setState 회피).
  const requestIdentity = JSON.stringify([token, page, filter, unreadOnly, retryTick]);

  // 비로그인은 로그인 페이지로(로그인 후 알림으로 복귀).
  // hydration 전에는 서버 스냅샷(비로그인)이라 로그인 여부가 미확정이므로 판단하지 않는다.
  useEffect(() => {
    if (hydrated && !isLoggedIn) router.replace("/login?next=/notifications");
  }, [hydrated, isLoggedIn, router]);

  // 검색 페이지와 동일한 stale 방어: generation + token 으로 늦은 응답이 최신을 덮지 못하게 한다.
  useEffect(() => {
    const requestToken = token;
    if (!requestToken || getSessionId() !== requestToken) return;
    const guard = beginAuthedRequest(generationRef, requestToken);

    fetchNotifications(page, PAGE_SIZE, unreadOnly, FILTER_GROUP_TYPES[filter])
      .then((res) => {
        if (!guard.isCurrent()) return;
        if (res.content.length === 0 && page > 0) {
          setPage((currentPage) => Math.max(0, currentPage - 1));
          return;
        }
        setResult({ identity: requestIdentity, status: "success", data: res });
      })
      .catch((e) => {
        if (!guard.isCurrent()) return;
        if (clearSessionIfUnauthorized(e, requestToken)) {
          router.replace("/login?next=/notifications");
          return;
        }
        setResult({ identity: requestIdentity, status: "error", data: null });
      });

    return guard.cancel;
  }, [requestIdentity, token, page, filter, unreadOnly, router]);

  const current = result.identity === requestIdentity;
  const loading = !current;
  const error = current && result.status === "error";
  const data = current && result.status === "success" ? result.data : null;
  const list = data?.content ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const hasReadNotifications = filter === "all" && !unreadOnly && (data?.totalElements ?? 0) > unreadCount;

  const changeFilter = (next: NotificationFilterId) => {
    if (next === filter) return;
    setActionError("");
    setPage(0);
    setFilter(next);
  };

  const toggleUnreadOnly = () => {
    setActionError("");
    setPage(0);
    setUnreadOnly((prev) => !prev);
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
    if (!requestToken || getSessionId() !== requestToken) return;
    setDeletingIds((ids) => new Set(ids).add(id));
    setActionError("");
    try {
      await deleteNotification(id);
      if (getSessionId() !== requestToken) return;
      if (list.length === 1 && page > 0) setPage((currentPage) => currentPage - 1);
      else setRetryTick((tick) => tick + 1);
    } catch (requestError) {
      if (getSessionId() !== requestToken) return;
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
    if (!(await confirm({ message: "읽은 알림을 모두 삭제할까요?\n삭제한 알림은 복구할 수 없습니다.", destructive: true, confirmLabel: "삭제" }))) return;
    const requestToken = token;
    if (!requestToken || getSessionId() !== requestToken) return;
    setCleaningRead(true);
    setActionError("");
    try {
      await deleteReadNotifications();
      if (getSessionId() !== requestToken) return;
      if (page === 0) setRetryTick((tick) => tick + 1);
      else setPage(0);
    } catch (requestError) {
      if (getSessionId() !== requestToken) return;
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

  const fg = "var(--foreground)";

  // hydration 전에는 로그인 여부 미확정 → 아래 본문(로딩 상태)으로 렌더해 깜빡임을 막는다.
  if (hydrated && !isLoggedIn) {
    return (
      <section className="min-h-screen flex items-center justify-center" style={{ color: fg }}>
        <p className="text-[14px] opacity-70">로그인 페이지로 이동합니다…</p>
      </section>
    );
  }

  return (
    <PageShell paddingClassName="relative min-h-screen pt-28 pb-20 px-4 sm:px-6 overflow-hidden" orb="none">
      <div className="max-w-5xl mx-auto relative">
        <div className="text-center mb-8">
          <p className="tracking-[0.4em] uppercase mb-3" style={{ color: "var(--accent)", fontSize: 11 }}>
            Notifications
          </p>
          <h1
            style={{
              fontFamily: "var(--font-black-han), sans-serif",
              fontSize: "clamp(32px, 4.5vw, 54px)",
              color: fg,
            }}
          >
            알림{unreadCount > 0 ? ` (${unreadCount > 99 ? "99+" : unreadCount})` : ""}
          </h1>
        </div>

        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="flex gap-1 p-1 rounded-full"
              style={{ background: "rgba(var(--ink-rgb), 0.06)" }}
            >
              {filters.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => changeFilter(f.id)}
                    aria-pressed={active}
                    className="relative px-4 py-2 text-[13px] rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    style={{ color: active ? "var(--surface-dark)" : "var(--foreground-muted)" }}
                  >
                    {active && (
                      <motion.div layoutId="notif-filter-pill" className="absolute inset-0 rounded-full" style={{ background: "var(--accent)" }} />
                    )}
                    <span className="relative">{f.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={toggleUnreadOnly}
              aria-pressed={unreadOnly}
              className="px-3.5 py-2 text-[13px] rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              style={{
                background: unreadOnly ? "var(--accent)" : "rgba(var(--ink-rgb), 0.06)",
                color: unreadOnly ? "var(--surface-dark)" : "var(--foreground-muted)",
              }}
            >
              안읽음만
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={markAll}
              disabled={busy || cleaningRead || unreadCount === 0}
              aria-busy={busy}
              className="flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-full transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              style={{ background: "rgba(var(--ink-rgb), 0.06)", color: fg }}
            >
              {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <CheckCheck size={15} aria-hidden />}
              {busy ? "처리 중…" : "모두 읽음"}
            </button>
            <button
              type="button"
              onClick={removeRead}
              disabled={cleaningRead || busy || !hasReadNotifications}
              aria-busy={cleaningRead}
              className="flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-full transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              style={{ background: "rgba(var(--ink-rgb), 0.06)", color: fg }}
            >
              <Trash2 size={14} aria-hidden /> {cleaningRead ? "정리 중…" : "읽은 알림 정리"}
            </button>
          </div>
        </div>

        {actionError ? <p role="alert" className="mb-4 text-[13px] text-[var(--danger)]">{actionError}</p> : null}

        {loading ? (
          <StatePanel compact>
            <Loader2 size={28} className="animate-spin text-[var(--accent)]" aria-hidden />
            <p>알림을 불러오는 중입니다.</p>
          </StatePanel>
        ) : error ? (
          <StatePanel compact role="alert">
            <Bell size={28} className="opacity-40" aria-hidden />
            <p className="opacity-80">알림을 불러오지 못했습니다.</p>
            <button
              type="button"
              onClick={() => setRetryTick((t) => t + 1)}
              className="rounded-full px-5 py-2 text-[13px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
            >
              다시 시도
            </button>
          </StatePanel>
        ) : list.length === 0 ? (
          <div className="space-y-4">
            <StatePanel compact>
              <Bell size={32} className="opacity-35" aria-hidden />
              <p className="font-medium">
                {unreadOnly ? "안 읽은 알림이 없습니다." : "알림이 없습니다."}
              </p>
              <p className="text-[12px] opacity-60">
                {unreadOnly
                  ? "새 알림이 오면 이 목록에 표시됩니다."
                  : "관심 있는 캠페인에 참여하면 소식을 알림으로 받을 수 있어요."}
              </p>
            </StatePanel>
            {filter === "all" && !unreadOnly ? <RecommendedCampaigns heading="참여해볼 만한 캠페인" /> : null}
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((n, i) => (
              <StaggerItem key={n.id} index={i}>
                <NotificationRow
                  item={n}
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
    </PageShell>
  );
}

"use client";

import Link from "next/link";
import { AtSign, BadgeCheck, Bell, CalendarClock, MessageCircle, UserPlus, Users, Check, Trash2, Loader2, Heart, Megaphone } from "lucide-react";
import {
  isNotificationNavigable,
  notificationTypeLabel,
  relativeTime,
  type NotificationItem,
} from "@/data/notifications";

function iconFor(type: string) {
  if (type === "CAMPAIGN_JOINED") return <Users size={16} aria-hidden />;
  if (type === "USER_FOLLOWED") return <UserPlus size={16} aria-hidden />;
  if (type === "MESSAGE_RECEIVED") return <MessageCircle size={16} aria-hidden />;
  if (type === "POST_LIKED" || type === "COMMENT_LIKED") return <Heart size={16} aria-hidden />;
  if (type === "CAMPAIGN_STATUS_CHANGED") return <Megaphone size={16} aria-hidden />;
  if (type === "CAMPAIGN_RECRUIT_ENDING") return <CalendarClock size={16} aria-hidden />;
  if (type === "CAMPAIGN_PROOF_CREATED") return <BadgeCheck size={16} aria-hidden />;
  if (type.endsWith("COMMENT_CREATED")) return <MessageCircle size={16} aria-hidden />;
  if (type === "COMMENT_REPLY_CREATED") return <MessageCircle size={16} aria-hidden />;
  if (type === "COMMENT_MENTIONED") return <AtSign size={16} aria-hidden />;
  return <Bell size={16} aria-hidden />;
}

export function NotificationRow({
  item,
  pending,
  deleting,
  onOpen,
  onMarkRead,
  onDelete,
}: {
  item: NotificationItem;
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
    background: item.read ? "var(--card)" : "var(--accent-soft)",
    borderColor: "var(--border)",
  };
  const content = (
    <>
      <div className="relative flex-shrink-0">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
        >
          {iconFor(item.type)}
        </div>
        {!item.read && (
          <span
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[rgba(var(--surface-dark-rgb),0.1)]"
            aria-hidden
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className="text-[14px] font-medium line-clamp-1"
            style={{ color: "var(--foreground)", opacity: item.read ? 0.72 : 1 }}
          >
            {item.title}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: item.read
                ? "rgba(var(--ink-rgb), 0.06)"
                : "rgba(var(--accent-rgb),0.22)",
              color: item.read ? ("rgba(var(--ink-rgb), 0.55)") : "var(--accent-secondary)",
            }}
          >
            {statusLabel}
          </span>
        </div>
        <p
          className="mt-0.5 text-[12px] line-clamp-2"
          style={{ color: "var(--foreground)", opacity: item.read ? 0.55 : 0.75 }}
        >
          {item.body}
        </p>
        <p className="mt-1 text-[11px] opacity-60 sm:hidden" style={{ color: "var(--foreground)" }}>
          {timeLabel} · {notificationTypeLabel(item.type)}
        </p>
      </div>
      <span className="hidden flex-shrink-0 text-[11px] opacity-60 sm:inline" style={{ color: "var(--foreground)" }}>
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
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition-colors hover:bg-[rgba(var(--accent-rgb),0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] py-1"
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
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          style={{ background: "rgba(var(--ink-rgb), 0.06)", color: "var(--foreground)" }}
          aria-label="읽음으로 표시"
        >
          {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Check size={15} aria-hidden />}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        disabled={deleting || pending}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger-solid)]"
        style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
        aria-label="알림 삭제"
      >
        {deleting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Trash2 size={14} aria-hidden />}
      </button>
    </div>
  );
}

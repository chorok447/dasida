"use client";

import Link from "next/link";
import { Bell, MessageCircle, UserPlus, Users, Check, Trash2, Loader2, Heart, Megaphone } from "lucide-react";
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
  if (type === "POST_LIKED") return <Heart size={16} aria-hidden />;
  if (type === "CAMPAIGN_STATUS_CHANGED") return <Megaphone size={16} aria-hidden />;
  if (type.endsWith("COMMENT_CREATED")) return <MessageCircle size={16} aria-hidden />;
  return <Bell size={16} aria-hidden />;
}

export function NotificationRow({
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

"use client";

import { Loader2, LogIn, CheckCircle2 } from "lucide-react";
import type { Campaign } from "@/data/campaigns";

export function CampaignCTABar({
  c,
  onJoin,
  onLeave,
  onLogin,
  action,
  disabled,
  loggedIn,
}: {
  c: Campaign;
  onJoin: () => void;
  onLeave: () => void;
  onLogin: () => void;
  action: "join" | "leave" | null;
  disabled: boolean;
  loggedIn: boolean;
}) {
  const panelStyle = {
    background: "var(--card)",
    borderColor: "var(--border)",
    color: "var(--foreground)",
  };
  const joinedStyle = { background: "rgba(125,211,163,0.18)", color: "var(--accent-secondary)", fontSize: 16 };
  const pending = action !== null;

  if (c.joinedByMe) {
    if (c.status === "open") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-5 px-6 rounded-2xl text-center font-medium"
            style={joinedStyle}
          >
            <CheckCircle2 size={20} aria-hidden />
            <span>참여 완료 · 모집 중인 캠페인입니다</span>
          </div>
          <button
            type="button"
            onClick={onLeave}
            disabled={disabled || pending}
            aria-busy={action === "leave"}
            aria-label={action === "leave" ? "참여 취소 처리 중" : "참여 취소"}
            className="inline-flex items-center justify-center gap-2 py-5 px-6 rounded-2xl font-medium hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "rgba(237,92,72,0.16)", color: "#ed5c48" }}
          >
            {action === "leave" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
            {action === "leave" ? "취소 처리 중…" : "참여 취소"}
          </button>
        </div>
      );
    }
    const joinedMessage =
      c.status === "closed"
        ? "참여 완료 · 모집이 마감된 캠페인입니다"
        : "참여 완료 · 종료된 캠페인입니다";
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 w-full py-5 rounded-2xl text-center font-medium"
        style={joinedStyle}
      >
        <CheckCircle2 size={20} aria-hidden />
        <span>{joinedMessage}</span>
      </div>
    );
  }

  if (c.recruitable) {
    if (!loggedIn) {
      return (
        <div
          className="flex flex-col items-center gap-3 rounded-2xl border px-6 py-6 text-center"
          style={panelStyle}
        >
          <p className="text-[14px]" style={{ color: "var(--foreground-muted)" }}>
            로그인 후 캠페인에 참여할 수 있어요.
          </p>
          <button
            type="button"
            onClick={onLogin}
            className="inline-flex items-center gap-2 rounded-full bg-[#7dd3a3] px-6 py-2.5 text-[14px] font-medium text-[#0f1f22]"
          >
            <LogIn size={16} aria-hidden />
            로그인하고 참여하기
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={onJoin}
        disabled={disabled || pending}
        aria-busy={action === "join"}
        aria-label={action === "join" ? "캠페인 참여 처리 중" : "캠페인 참여하기"}
        className="inline-flex w-full items-center justify-center gap-2 py-5 rounded-2xl font-medium hover:-translate-y-0.5 transition-transform shadow-[0_30px_60px_-20px_rgba(125,211,163,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "#7dd3a3", color: "#0f1f22", fontSize: 17 }}
      >
        {action === "join" ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
        {action === "join" ? "참여 처리 중…" : "캠페인 참여하기"}
      </button>
    );
  }

  const unavailableMessage =
    c.recruitState === "before_recruit"
      ? "모집 시작 전이라 참여할 수 없습니다"
      : c.recruitState === "ended"
        ? "종료된 캠페인이라 참여할 수 없습니다"
        : c.recruitState === "closed"
          ? "모집이 마감되어 참여할 수 없습니다"
          : "정원이 마감되어 참여할 수 없습니다";

  return (
    <div
      role="status"
      className="w-full rounded-2xl border px-6 py-5 text-center"
      style={{
        ...panelStyle,
        color: "var(--foreground-muted)",
      }}
    >
      <p className="text-[15px] font-medium">{unavailableMessage}</p>
      <p className="mt-1 text-[12px] opacity-70">현재 이 캠페인은 새 참여를 받지 않습니다.</p>
    </div>
  );
}

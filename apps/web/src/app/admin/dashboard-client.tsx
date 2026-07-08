"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Users, FileText, Megaphone, Flag, Inbox } from "lucide-react";
import { StatePanel } from "@/components/ui/state-panel";
import { fetchAdminSummary, type AdminSummary } from "@/data/admin";

// 저장된 결과의 tick 이 현재 retryTick 과 다르면 로딩 중으로 간주한다(effect 내 동기 setState 회피).
type SummaryResult = { tick: number; status: "success" | "error"; data: AdminSummary | null };

export default function DashboardClient() {
  const [retryTick, setRetryTick] = useState(0);
  const [result, setResult] = useState<SummaryResult>({ tick: -1, status: "success", data: null });

  useEffect(() => {
    let cancelled = false;
    fetchAdminSummary()
      .then((data) => {
        if (!cancelled) setResult({ tick: retryTick, status: "success", data });
      })
      .catch(() => {
        if (!cancelled) setResult({ tick: retryTick, status: "error", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  const state =
    result.tick !== retryTick
      ? ({ status: "loading" } as const)
      : result.status === "success" && result.data
        ? ({ status: "success", data: result.data } as const)
        : ({ status: "error" } as const);

  if (state.status === "loading") {
    return (
      <StatePanel compact>
        <Loader2 className="animate-spin" size={20} aria-hidden />
        <p>통계를 불러오는 중입니다…</p>
      </StatePanel>
    );
  }

  if (state.status === "error") {
    return (
      <StatePanel compact>
        <p>통계를 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={() => setRetryTick((t) => t + 1)}
          className="rounded-full border px-4 py-2 text-[13px]"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          다시 시도
        </button>
      </StatePanel>
    );
  }

  const { data } = state;
  const cards = [
    { label: "활동 회원", value: data.users, icon: Users },
    { label: "게시글", value: data.posts, icon: FileText },
    { label: "캠페인", value: data.campaigns, icon: Megaphone },
    { label: "누적 신고", value: data.totalReports, icon: Inbox },
  ];

  return (
    <div className="space-y-6">
      {/* 대기 신고: 관리자의 핵심 작업 큐라 별도 강조 카드로 노출한다. */}
      <Link
        href="/admin/reports"
        className="flex items-center justify-between rounded-3xl border p-6 transition-transform hover:-translate-y-0.5 motion-reduce:transform-none"
        style={{
          background: data.pendingReports > 0 ? "var(--accent-soft)" : "var(--card)",
          borderColor: "var(--border)",
          color: "var(--foreground)",
        }}
      >
        <div className="flex items-center gap-4">
          <Flag size={22} aria-hidden style={{ color: "var(--accent-secondary)" }} />
          <div>
            <p className="text-[14px] font-semibold">처리 대기 신고</p>
            <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
              {data.pendingReports > 0
                ? "확인이 필요한 신고가 있습니다. 눌러서 신고 관리로 이동하세요."
                : "대기 중인 신고가 없습니다."}
            </p>
          </div>
        </div>
        <span
          className="text-[32px]"
          style={{ fontFamily: "'Black Han Sans', sans-serif" }}
          aria-label={`대기 신고 ${data.pendingReports}건`}
        >
          {data.pendingReports.toLocaleString()}
        </span>
      </Link>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-3xl border p-5"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <Icon size={18} aria-hidden style={{ color: "var(--accent-secondary)" }} />
            <p className="mt-3 text-[24px]" style={{ fontFamily: "'Black Han Sans', sans-serif" }}>
              {value.toLocaleString()}
            </p>
            <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

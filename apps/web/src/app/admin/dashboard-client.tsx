"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Users, FileText, Megaphone, Flag, Inbox, ShieldBan, ScrollText } from "lucide-react";
import { StatePanel } from "@/components/ui/state-panel";
import {
  fetchAdminLogs,
  fetchAdminSummary,
  type AdminActionLogItem,
  type AdminSummary,
} from "@/data/admin";
import { ACTION_LABELS, RESTRICTIVE_ACTIONS } from "./logs/action-labels";
import { StatsChartSection } from "./stats-chart";

// 저장된 결과의 tick 이 현재 retryTick 과 다르면 로딩 중으로 간주한다(effect 내 동기 setState 회피).
type SummaryResult = { tick: number; status: "success" | "error"; data: AdminSummary | null };

const RECENT_LOGS_SIZE = 5;

export default function DashboardClient() {
  const [retryTick, setRetryTick] = useState(0);
  const [result, setResult] = useState<SummaryResult>({ tick: -1, status: "success", data: null });
  // 최근 조치는 보조 정보라 실패해도 대시보드를 막지 않는다(null = 로딩/실패 → 섹션 숨김).
  const [recentLogs, setRecentLogs] = useState<AdminActionLogItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminSummary()
      .then((data) => {
        if (!cancelled) setResult({ tick: retryTick, status: "success", data });
      })
      .catch(() => {
        if (!cancelled) setResult({ tick: retryTick, status: "error", data: null });
      });
    fetchAdminLogs({ size: RECENT_LOGS_SIZE })
      .then((res) => {
        if (!cancelled) setRecentLogs(res.content);
      })
      .catch(() => {
        if (!cancelled) setRecentLogs(null);
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
      <div className="grid gap-4 sm:grid-cols-2">
        {/* 대기 신고: 관리자의 핵심 작업 큐라 별도 강조 카드로 노출한다. */}
        <QueueCard
          href="/admin/reports"
          icon={Flag}
          title="처리 대기 신고"
          description={
            data.pendingReports > 0
              ? "확인이 필요한 신고가 있습니다. 눌러서 신고 관리로 이동하세요."
              : "대기 중인 신고가 없습니다."
          }
          count={data.pendingReports}
          countLabel={`대기 신고 ${data.pendingReports}건`}
          highlighted={data.pendingReports > 0}
        />
        <QueueCard
          href="/admin/users?filter=suspended"
          icon={ShieldBan}
          title="정지 중 회원"
          description={
            data.suspendedUsers > 0
              ? "현재 이용이 정지된 계정입니다. 눌러서 목록을 확인하세요."
              : "정지 중인 회원이 없습니다."
          }
          count={data.suspendedUsers}
          countLabel={`정지 중 회원 ${data.suspendedUsers}명`}
          highlighted={false}
        />
      </div>

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

      <StatsChartSection />

      {recentLogs && recentLogs.length > 0 && (
        <section
          className="rounded-3xl border p-5"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-[14px] font-semibold">
              <ScrollText size={16} aria-hidden style={{ color: "var(--accent-secondary)" }} />
              최근 조치
            </h2>
            <Link href="/admin/logs" className="text-[12px] hover:underline" style={{ color: "var(--foreground-muted)" }}>
              전체 보기
            </Link>
          </div>
          <ul className="space-y-2.5">
            {recentLogs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                <span
                  className="rounded-full px-2 py-0.5 text-[11px]"
                  style={
                    RESTRICTIVE_ACTIONS.has(log.action)
                      ? { background: "var(--danger-soft)", color: "var(--danger)" }
                      : { background: "var(--accent-soft)", color: "var(--accent-secondary)" }
                  }
                >
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
                <span>{log.admin.name}</span>
                {log.detail && (
                  <span className="min-w-0 truncate" style={{ color: "var(--foreground-muted)" }}>
                    {log.detail}
                  </span>
                )}
                <span className="ml-auto text-[12px]" style={{ color: "var(--foreground-muted)" }}>
                  {new Date(log.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function QueueCard({
  href,
  icon: Icon,
  title,
  description,
  count,
  countLabel,
  highlighted,
}: {
  href: string;
  icon: typeof Flag;
  title: string;
  description: string;
  count: number;
  countLabel: string;
  highlighted: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-3xl border p-6 transition-transform hover:-translate-y-0.5 motion-reduce:transform-none"
      style={{
        background: highlighted ? "var(--accent-soft)" : "var(--card)",
        borderColor: "var(--border)",
        color: "var(--foreground)",
      }}
    >
      <div className="flex items-center gap-4">
        <Icon size={22} aria-hidden style={{ color: "var(--accent-secondary)" }} />
        <div>
          <p className="text-[14px] font-semibold">{title}</p>
          <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
            {description}
          </p>
        </div>
      </div>
      <span className="text-[32px]" style={{ fontFamily: "'Black Han Sans', sans-serif" }} aria-label={countLabel}>
        {count.toLocaleString()}
      </span>
    </Link>
  );
}

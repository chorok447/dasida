"use client";

import { StaggerItem } from "@/components/scroll-reveal";
import { Monitor, Globe } from "lucide-react";
import { StatePanel } from "@/components/ui/state-panel";
import { fetchAccessLogsPage, type AccessLogItem } from "@/data/access-logs";
import { useTheme } from "@/lib/theme-context";
import { PaginatedSection } from "./paginated-section";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function AccessLogRow({ item }: { item: AccessLogItem }) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <article
      className="rounded-2xl border p-5"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "var(--card)",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "var(--border)",
        color: dark ? "#f9f7f2" : "var(--foreground)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]"
            style={{ background: "var(--accent-soft)", color: "var(--accent-secondary)" }}
          >
            <Monitor size={12} aria-hidden />
            {item.os}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]"
            style={{
              background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)",
              color: dark ? "rgba(255,255,255,0.75)" : "var(--foreground-muted)",
            }}
          >
            <Globe size={12} aria-hidden />
            {item.ipAddress}
          </span>
        </div>
        <time dateTime={item.accessedAt} className="text-[11px] opacity-55">
          {formatTime(item.accessedAt)}
        </time>
      </div>
    </article>
  );
}

export function AccessLogsList({ page, onPageChange }: { page: number; onPageChange: (page: number) => void }) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-6 opacity-70" style={{ color: dark ? "rgba(255,255,255,0.7)" : "var(--foreground-muted)" }}>
        최근 1년간 로그인·세션 갱신 시점의 OS와 IP를 보여줘요.
      </p>
      <PaginatedSection<AccessLogItem>
        identityKey="access-logs"
        page={page}
        onPageChange={onPageChange}
        fetcher={fetchAccessLogsPage}
        loadingLabel="접속 기록을 불러오는 중입니다."
        errorLabel="접속 기록을 불러오지 못했습니다."
        empty={
          <StatePanel className="min-h-48 rounded-2xl">
            <Monitor size={28} className="text-[#7dd3a3]" />
            <p>아직 접속 기록이 없어요.</p>
          </StatePanel>
        }
        renderItems={(items) => (
          <div className="space-y-3">
            {items.map((item, i) => (
              <StaggerItem key={item.id} index={i}>
                <AccessLogRow item={item} />
              </StaggerItem>
            ))}
          </div>
        )}
      />
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { StatePanel } from "@/components/ui/state-panel";

/** 서버 fetch 가 있는 라우트 세그먼트의 loading.tsx 공용 본문. */
export function RouteLoading({ label }: { label: string }) {
  return (
    <PageShell paddingClassName="relative min-h-screen px-6 pb-20 pt-28" orb="none">
      <StatePanel className="relative mx-auto min-h-72 max-w-2xl" aria-busy>
        <Loader2 className="animate-spin" size={22} style={{ color: "var(--accent-strong)" }} aria-hidden />
        {label}
      </StatePanel>
    </PageShell>
  );
}

/** 라우트 세그먼트 error.tsx 공용 본문. 세그먼트별 문구만 바꿔 쓴다. */
export function RouteError({
  error,
  reset,
  label,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  label: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell paddingClassName="relative min-h-screen px-6 pb-20 pt-28" orb="none">
      <StatePanel className="relative mx-auto min-h-72 max-w-2xl">
        <p>{label}</p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-medium transition-transform hover:-translate-y-0.5"
          style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
        >
          <RefreshCw size={14} /> 다시 시도
        </button>
      </StatePanel>
    </PageShell>
  );
}

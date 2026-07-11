"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RefreshCw } from "lucide-react";

// 루트 에러 바운더리. 테마 컨텍스트 등 상위 상태에 의존하지 않도록 CSS 토큰만 사용한다.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ backgroundImage: "var(--page-gradient)", color: "var(--foreground)" }}
    >
      <h1
        style={{ fontFamily: "var(--font-black-han), sans-serif" }}
        className="text-[clamp(28px,4vw,40px)]"
      >
        문제가 발생했어요
      </h1>
      <p className="max-w-md text-[15px]" style={{ color: "var(--foreground-muted)" }}>
        일시적인 오류일 수 있어요. 다시 시도하거나 메인페이지로 이동해주세요.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 font-medium transition-transform hover:-translate-y-0.5"
          style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
        >
          <RefreshCw size={16} /> 다시 시도
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border px-6 py-3 font-medium transition-transform hover:-translate-y-0.5"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <Home size={16} /> 메인페이지로 이동
        </Link>
      </div>
    </section>
  );
}

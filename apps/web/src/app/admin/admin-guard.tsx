"use client";

import { useEffect } from "react";
import { notFound, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { StatePanel } from "@/components/ui/state-panel";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";

/**
 * 관리자 라우트 가드. 비로그인은 로그인으로 보내고, 로그인했지만 ADMIN 이 아니면
 * 404 처리한다(관리자 경로의 존재 자체를 드러내지 않기 위해 403 대신 404).
 * 실제 데이터 접근 통제는 백엔드 /api/admin/** 의 ROLE_ADMIN 이 담당하고, 이 가드는 UX 용이다.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile, loading, error, isLoggedIn, retry } = useCurrentUserProfile();

  useEffect(() => {
    if (!loading && !isLoggedIn) router.replace("/login?next=/admin");
  }, [loading, isLoggedIn, router]);

  if (profile && profile.role !== "ADMIN") notFound();

  if (!profile) {
    return (
      <PageShell orb="none">
        <StatePanel className="mx-auto max-w-xl">
          {error ? (
            <>
              <p>{error}</p>
              <button
                type="button"
                onClick={retry}
                className="rounded-full border px-4 py-2 text-[13px]"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                다시 시도
              </button>
            </>
          ) : (
            <>
              <Loader2 className="animate-spin" size={20} aria-hidden />
              <p>권한을 확인하는 중입니다…</p>
            </>
          )}
        </StatePanel>
      </PageShell>
    );
  }

  return <>{children}</>;
}

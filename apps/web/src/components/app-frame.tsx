"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme-context";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Footer } from "@/components/footer";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { OfflineBanner } from "@/components/offline-banner";
import { RealtimeUpdates } from "@/components/realtime-updates";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <ConfirmProvider>
      <div className="relative w-full transition-colors pb-14 md:pb-0" style={{ background: "var(--surface)" }}>
        {/* 키보드 사용자용: 고정 헤더의 링크들을 건너뛰고 본문으로 이동 */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only fixed left-4 top-4 z-50 rounded-full px-4 py-2 text-[13px] font-medium"
          style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
        >
          본문 바로가기
        </a>
        <OfflineBanner />
        <SiteHeader />
        <ThemeToggle />
        <div id="main-content" tabIndex={-1} className="outline-none">
          {children}
        </div>
        <Footer />
        <MobileBottomNav />
        <RealtimeUpdates />
        <Toaster theme={theme === "dark" ? "dark" : "light"} position="bottom-center" toastOptions={{ style: { borderRadius: 16 } }} />
      </div>
    </ConfirmProvider>
  );
}

"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme-context";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Footer } from "@/components/footer";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <ConfirmProvider>
      <div
        className="relative w-full transition-colors pb-14 md:pb-0"
        style={{ background: theme === "dark" ? "#0f1f22" : "#f9f7f2" }}
      >
        <SiteHeader />
        <ThemeToggle />
        {children}
        <Footer />
        <MobileBottomNav />
        <Toaster theme={theme === "dark" ? "dark" : "light"} position="bottom-center" toastOptions={{ style: { borderRadius: 16 } }} />
      </div>
    </ConfirmProvider>
  );
}

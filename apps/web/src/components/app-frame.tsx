"use client";

import { useTheme } from "@/lib/theme-context";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Footer } from "@/components/footer";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div
      className="relative w-full transition-colors"
      style={{ background: theme === "dark" ? "#0f1f22" : "#f9f7f2" }}
    >
      <SiteHeader />
      <ThemeToggle />
      {children}
      <Footer />
    </div>
  );
}

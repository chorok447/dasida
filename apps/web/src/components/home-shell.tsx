"use client";

import { useTheme } from "@/lib/theme-context";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Hero3D } from "@/components/hero-3d";
import { TiltCardGrid } from "@/components/tilt-card-grid";
import { Carousel3D } from "@/components/carousel-3d";
import { Footer } from "@/components/footer";

export function HomeShell() {
  const { theme } = useTheme();
  return (
    <div
      className="relative w-full transition-colors"
      style={{ background: theme === "dark" ? "#0f1f22" : "#f9f7f2" }}
    >
      <SiteHeader />
      <ThemeToggle />
      <Hero3D />
      <TiltCardGrid />
      <Carousel3D />
      <Footer />
    </div>
  );
}

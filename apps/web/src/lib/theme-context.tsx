"use client";

import { ThemeProvider as NextThemeProvider, useTheme as useNextTheme } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {children}
    </NextThemeProvider>
  );
}

// 기존 컴포넌트 호환 래퍼: { theme, toggle } 시그니처 유지.
// 마운트 전 resolvedTheme은 undefined → dark로 fallback해 SSR/첫 렌더를 맞춘다.
export function useTheme() {
  const { resolvedTheme, setTheme } = useNextTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  return { theme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}

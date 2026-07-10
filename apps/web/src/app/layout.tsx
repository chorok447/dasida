import type { Metadata } from "next";
import { Black_Han_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-context";
import { AppFrame } from "@/components/app-frame";
import { getSiteUrl } from "@/lib/site-url";

// 브랜드 헤딩 폰트. globals.css 의 @import(렌더 블로킹 + 외부 요청) 대신 next/font 로
// 셀프호스팅 — 빌드에 폰트 파일이 포함되고 display:swap 이 적용된다.
// 사용처는 fontFamily: "var(--font-black-han)" — 리터럴 폰트명을 다시 쓰지 말 것.
const blackHanSans = Black_Han_Sans({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-black-han",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "다시,다 — 업사이클 플랫폼",
    template: "%s | 다시,다",
  },
  description: "버려진 자원에 새 가치를 더하는 업사이클링 캠페인 플랫폼",
  openGraph: {
    siteName: "다시,다",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`h-full antialiased ${blackHanSans.variable}`} suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeProvider>
          <AppFrame>{children}</AppFrame>
        </ThemeProvider>
      </body>
    </html>
  );
}

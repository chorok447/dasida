"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "@/lib/theme-context";
import { useAuthSession } from "@/lib/use-auth-session";

// 로그아웃 시 머무르면 안 되는(인증 필요) 경로 prefix.
const PROTECTED_PREFIXES = ["/posts/new", "/campaigns/new", "/mypage", "/profile/edit"];

// href가 있으면 링크, 없으면 아직 미구현 페이지(비활성 표시).
const items: { label: string; href?: string }[] = [
  { label: "홈", href: "/" },
  { label: "피드", href: "/feed" },
  { label: "캠페인", href: "/campaigns" },
  { label: "마이페이지", href: "/mypage" },
  { label: "로고" },
];

export function SiteHeader() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn, name, logout } = useAuthSession();

  const onLogout = () => {
    logout();
    // 인증이 필요한 페이지에 있었다면 피드로 보내고, 일반 페이지면 그대로 둔다.
    if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) router.push("/feed");
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 backdrop-blur-xl border-b transition-colors"
      style={{
        background: dark ? "rgba(15,31,34,0.55)" : "rgba(249,247,242,0.7)",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" style={{ color: dark ? "#7dd3a3" : "#1c4044" }}>
          <span style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 22 }}>다시,다</span>
          <span className="hidden text-[10px] tracking-[0.3em] opacity-60 sm:inline">UPCYCLE</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {items.map((it) => {
            const isActive = it.href === pathname;
            const className = "relative px-4 py-2 text-[14px] transition-opacity";
            const style = { color: dark ? "#f9f7f2" : "#1c4044", opacity: isActive ? 1 : 0.7 };
            const dot = isActive && (
              <motion.div
                layoutId="navdot"
                className="absolute left-1/2 -translate-x-1/2 bottom-1 w-1.5 h-1.5 rounded-full"
                style={{ background: "#7dd3a3" }}
              />
            );
            return it.href ? (
              <Link key={it.label} href={it.href} className={className} style={style}>
                {it.label}
                {dot}
              </Link>
            ) : (
              <span key={it.label} className={`${className} cursor-default`} style={{ ...style, opacity: 0.4 }}>
                {it.label}
              </span>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/search"
            className="flex h-9 items-center justify-center gap-2 rounded-full px-3"
            style={{
              background: pathname === "/search" ? "rgba(125,211,163,0.18)" : dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.06)",
              color: pathname === "/search" ? "#148a90" : dark ? "#f9f7f2" : "#1c4044",
            }}
            aria-label="통합 검색"
          >
            <Search size={16} />
            <span className="hidden xl:inline text-[12px]">검색</span>
          </Link>
          <Link
            href="/notifications"
            className="w-9 h-9 rounded-full flex items-center justify-center relative"
            style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.06)", color: dark ? "#f9f7f2" : "#1c4044" }}
            aria-label="알림"
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#7dd3a3]" />
          </Link>
          {/* 서버 스냅샷은 항상 로그아웃 상태 → 비로그인 뷰로 hydration, 이후 클라이언트에서 갱신. */}
          {isLoggedIn ? (
            <>
              <span className="hidden text-[13px] px-1 sm:inline" style={{ color: dark ? "#f9f7f2" : "#1c4044" }}>
                {name ?? "사용자"}
              </span>
              <button
                onClick={onLogout}
                className="text-[13px] px-3 py-1.5 rounded-full transition-colors"
                style={{ color: dark ? "rgba(255,255,255,0.8)" : "rgba(28,64,68,0.8)" }}
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[13px] px-3 py-1.5 rounded-full transition-colors"
                style={{ color: dark ? "rgba(255,255,255,0.8)" : "rgba(28,64,68,0.8)" }}
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="text-[13px] px-3 py-1.5 rounded-full font-medium"
                style={{ background: "#7dd3a3", color: "#0f1f22" }}
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, MessageCircle, Search, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useAuthSession } from "@/lib/use-auth-session";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import { useDmUnread, useNotificationUnread } from "@/lib/use-unread-badges";
import { MAIN_NAV_ITEMS } from "@/lib/nav-items";

// 로그아웃 시 머무르면 안 되는(인증 필요) 경로 prefix.
const PROTECTED_PREFIXES = ["/posts/new", "/campaigns/new", "/mypage", "/profile/edit", "/messages"];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const onNotifications = pathname === "/notifications";
  const onMessages = pathname.startsWith("/messages");
  const { isLoggedIn, name, logout, sessionId: token } = useAuthSession();
  // 관리자에게만 /admin 진입점을 보여준다(권한 자체는 서버가 검사).
  const { profile } = useCurrentUserProfile();
  const isAdmin = profile?.role === "ADMIN";
  const unread = useNotificationUnread(token);
  const dmUnread = useDmUnread(token);

  const onLogout = () => {
    void logout().finally(() => {
      if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) router.push("/feed");
    });
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 backdrop-blur-xl border-b transition-colors"
      style={{
        // 히어로 그라데이션이 비쳐도 로고/태그라인 대비 4.5:1을 지키는 최소 불투명도
        background: "rgba(var(--surface-rgb), 0.85)",
        borderColor: "var(--border)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" style={{ color: "var(--accent-secondary)" }}>
          <span style={{ fontFamily: "var(--font-black-han), sans-serif", fontSize: 22 }}>다시,다</span>
          <span className="hidden text-[10px] tracking-[0.3em] opacity-90 sm:inline">UPCYCLE</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1" aria-label="주요 메뉴">
          {MAIN_NAV_ITEMS.map((it) => {
            const isActive = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href));
            const className = "relative rounded-lg px-4 py-2 text-[14px] transition-opacity hover:opacity-100";
            const style = { color: "var(--heading)", opacity: isActive ? 1 : 0.7 };
            const dot = isActive && (
              <motion.div
                layoutId="navdot"
                className="absolute left-1/2 -translate-x-1/2 bottom-1 w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--accent)" }}
              />
            );
            return (
              <Link key={it.label} href={it.href} className={className} style={style} aria-current={isActive ? "page" : undefined}>
                {it.label}
                {dot}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          {isAdmin && (
            <Link
              href="/admin"
              className="flex h-9 items-center justify-center gap-2 rounded-full px-3 transition-[background-color,color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 motion-reduce:transform-none"
              style={{
                background: pathname.startsWith("/admin") ? "rgba(var(--accent-rgb),0.18)" : "rgba(var(--ink-rgb), 0.07)",
                color: pathname.startsWith("/admin") ? "var(--accent-strong)" : "var(--heading)",
              }}
              aria-label="관리자 페이지로 이동"
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
            >
              <ShieldCheck size={16} aria-hidden />
              <span className="hidden xl:inline text-[12px]">관리자</span>
            </Link>
          )}
          <Link
            href="/search"
            className="flex h-9 items-center justify-center gap-2 rounded-full px-3 transition-[background-color,color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 motion-reduce:transform-none"
            style={{
              background: pathname === "/search" ? "rgba(var(--accent-rgb),0.18)" : "rgba(var(--ink-rgb), 0.07)",
              color: pathname === "/search" ? "var(--accent-strong)" : "var(--heading)",
            }}
            aria-label="검색 페이지로 이동"
          >
            <Search size={16} />
            <span className="hidden xl:inline text-[12px]">검색</span>
          </Link>
          <Link
            href="/messages"
            className="relative hidden h-9 items-center justify-center gap-2 rounded-full px-3 transition-[background-color,color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 motion-reduce:transform-none sm:flex"
            style={{
              background: onMessages ? "rgba(var(--accent-rgb),0.18)" : "rgba(var(--ink-rgb), 0.07)",
              color: onMessages ? "var(--accent-strong)" : "var(--heading)",
            }}
            aria-label={dmUnread > 0 ? `DM, 읽지 않음 ${dmUnread > 99 ? "99+" : dmUnread}개` : "DM"}
            aria-current={onMessages ? "page" : undefined}
          >
            <MessageCircle size={16} aria-hidden />
            <span className="hidden lg:inline text-[12px]">DM</span>
            {isLoggedIn && dmUnread > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center text-[10px] font-semibold leading-none"
                style={{ background: "var(--danger-solid)", color: "#ffffff" }}
                aria-hidden
              >
                {dmUnread > 99 ? "99+" : dmUnread}
              </span>
            )}
          </Link>
          <Link
            href="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full transition-[background-color,color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 motion-reduce:transform-none"
            style={{
              background: onNotifications
                ? "rgba(var(--accent-rgb),0.18)"
                : "rgba(var(--ink-rgb), 0.07)",
              color: onNotifications ? "var(--accent-strong)" : "var(--heading)",
            }}
            aria-label={unread > 0 ? `알림, 읽지 않음 ${unread > 99 ? "99+" : unread}개` : "알림"}
            aria-current={onNotifications ? "page" : undefined}
          >
            <Bell size={18} aria-hidden />
            {isLoggedIn && unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center text-[10px] font-semibold leading-none"
                style={{ background: "var(--danger-solid)", color: "#ffffff" }}
                aria-hidden
              >
                {unread > 99 ? "99+" : unread}
              </motion.span>
            )}
          </Link>
          {/* 서버 스냅샷은 항상 로그아웃 상태 → 비로그인 뷰로 hydration, 이후 클라이언트에서 갱신. */}
          {isLoggedIn ? (
            <>
              <span className="hidden text-[13px] px-1 sm:inline" style={{ color: "var(--heading)" }}>
                {name ?? "사용자"}
              </span>
              <button
                onClick={onLogout}
                className="rounded-full px-3 py-1.5 text-[13px] transition-colors hover:bg-[rgba(var(--ink-rgb),0.06)]"
                style={{ color: "rgba(var(--ink-rgb), 0.8)" }}
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-3 py-1.5 text-[13px] transition-colors hover:bg-[rgba(var(--ink-rgb),0.06)]"
                style={{ color: "rgba(var(--ink-rgb), 0.8)" }}
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="rounded-full px-3 py-1.5 text-[13px] font-medium transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 motion-reduce:transform-none"
                style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
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

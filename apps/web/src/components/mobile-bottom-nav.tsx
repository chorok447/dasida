"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutList, Flag, MessageCircle, User } from "lucide-react";
import { useAuthSession } from "@/lib/use-auth-session";
import { useDmUnread } from "@/lib/use-unread-badges";

const tabs = [
  { label: "홈", href: "/", icon: Home, match: (path: string) => path === "/" },
  { label: "피드", href: "/feed", icon: LayoutList, match: (path: string) => path.startsWith("/feed") || path.startsWith("/posts") },
  { label: "캠페인", href: "/campaigns", icon: Flag, match: (path: string) => path.startsWith("/campaigns") },
  { label: "DM", href: "/messages", icon: MessageCircle, match: (path: string) => path.startsWith("/messages") },
  { label: "마이", href: "/mypage", icon: User, match: (path: string) => path.startsWith("/mypage") || path.startsWith("/profile") },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { sessionId: token, isLoggedIn } = useAuthSession();
  // 모바일에서는 헤더 DM 링크가 숨겨지므로 미읽음 배지를 여기서 보여준다.
  const dmUnread = useDmUnread(token);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl md:hidden"
      style={{
        background: "color-mix(in srgb, var(--surface) 93%, transparent)",
        borderColor: "var(--border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      aria-label="주요 메뉴"
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch justify-around px-2">
        {tabs.map(({ label, href, icon: Icon, match }) => {
          const active = match(pathname);
          const showBadge = label === "DM" && isLoggedIn && dmUnread > 0;
          return (
            <Link
              key={href}
              href={href}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 transition-opacity"
              style={{ color: active ? "var(--accent)" : "var(--foreground-muted)" }}
              aria-current={active ? "page" : undefined}
              aria-label={showBadge ? `DM, 읽지 않음 ${dmUnread > 99 ? "99+" : dmUnread}개` : undefined}
            >
              <span className="relative">
                <Icon size={20} aria-hidden />
                {showBadge && (
                  <span
                    className="absolute -top-1.5 -right-2.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none"
                    style={{ background: "#ed5c48", color: "#ffffff" }}
                    aria-hidden
                  >
                    {dmUnread > 99 ? "99+" : dmUnread}
                  </span>
                )}
              </span>
              <span className="truncate text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

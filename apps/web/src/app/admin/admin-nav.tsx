"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Flag, Users } from "lucide-react";

const items = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/reports", label: "신고 관리", icon: Flag },
  { href: "/admin/users", label: "회원 관리", icon: Users },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <header className="mb-8">
      <p className="mb-2 text-[11px] uppercase tracking-[0.4em]" style={{ color: "var(--accent-secondary)" }}>
        Admin
      </p>
      <h1
        className="mb-6 text-[32px]"
        style={{ fontFamily: "'Black Han Sans', sans-serif", color: "var(--foreground)" }}
      >
        관리자
      </h1>
      <nav aria-label="관리자 메뉴" className="flex flex-wrap gap-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] transition-colors"
              style={
                active
                  ? { background: "var(--accent)", borderColor: "var(--accent)", color: "#0f1f22" }
                  : { background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }
              }
            >
              <Icon size={14} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

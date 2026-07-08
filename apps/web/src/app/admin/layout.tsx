import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { AdminGuard } from "./admin-guard";
import { AdminNav } from "./admin-nav";

// 관리자 화면은 검색엔진에 노출하지 않는다.
export const metadata: Metadata = {
  title: "관리자 | 다시, 다",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <PageShell orb="right">
        <div className="mx-auto w-full max-w-5xl">
          <AdminNav />
          {children}
        </div>
      </PageShell>
    </AdminGuard>
  );
}

"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LogIn, RefreshCw } from "lucide-react";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import { ActivitySummary } from "./activity-summary";
import { CommentedPostsGrid, MyPostsGrid } from "./my-posts-grid";
import { SavedCampaignsGrid } from "./saved-campaigns-grid";
import { SavedPostsGrid } from "./saved-posts-grid";
import { UserCampaignsList } from "./joined-campaigns-list";
import { ReportsList } from "./reports-list";
import { AccessLogsList } from "./access-logs-list";
import { MypageAccountPanel } from "./mypage-account-panel";
import { MypageProfileHeader } from "./mypage-profile-header";
import { MypageTabBar } from "./mypage-tab-bar";
import { parseMypageTab, type MypageTab } from "./mypage-types";
import { PageShell } from "@/components/page-shell";
import { StatePanel } from "@/components/ui/state-panel";

function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export default function MyPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile, loading, error, isLoggedIn, retry } = useCurrentUserProfile();
  const [emailOverride, setEmailOverride] = useState<{ userId: number; email: string } | null>(null);
  const [savedCampaignPage, setSavedCampaignPage] = useState(0);

  const tab = parseMypageTab(searchParams.get("tab"));
  const page = parsePage(searchParams.get("page"));
  const displayedProfile = profile && emailOverride?.userId === profile.id
    ? { ...profile, email: emailOverride.email }
    : profile;

  const navigate = useCallback(
    (nextTab: MypageTab, nextPage: number) => {
      const params = new URLSearchParams();
      params.set("tab", nextTab);
      params.set("page", String(nextPage));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  const onSelectTab = useCallback((nextTab: MypageTab) => {
    if (nextTab !== "saved") setSavedCampaignPage(0);
    navigate(nextTab, 0);
  }, [navigate]);
  const onPageChange = useCallback((nextPage: number) => navigate(tab, nextPage), [navigate, tab]);

  return (
    <PageShell paddingClassName="relative min-h-screen overflow-hidden" orb="left">
      <div className="relative pb-20">
        {loading ? (
          <div className="px-6 pt-32">
            <StatePanel className="mx-auto min-h-72 max-w-3xl">
              <RefreshCw size={28} className="animate-spin text-[#7dd3a3]" />
              <p>사용자 정보를 불러오는 중입니다.</p>
            </StatePanel>
          </div>
        ) : !isLoggedIn ? (
          <div className="px-6 pt-32">
            <StatePanel className="mx-auto min-h-72 max-w-3xl">
              <LogIn size={30} className="text-[#7dd3a3]" />
              <p>마이페이지를 보려면 로그인이 필요합니다.</p>
              <Link href="/login" className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
                로그인 페이지로 이동
              </Link>
            </StatePanel>
          </div>
        ) : error || !profile ? (
          <div className="px-6 pt-32">
            <StatePanel className="mx-auto min-h-72 max-w-3xl" role="alert">
              <p>{error || "사용자 정보를 불러오지 못했습니다."}</p>
              <button type="button" onClick={retry} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
                다시 시도
              </button>
            </StatePanel>
          </div>
        ) : (
          <>
            <MypageProfileHeader profile={displayedProfile ?? profile} />
            <ActivitySummary key={`summary-${profile.id}`} onSelectTab={onSelectTab} />
            <MypageTabBar tab={tab} onSelect={onSelectTab} />
            <div className="mx-auto max-w-5xl px-6 py-10 sm:px-8">
              {tab === "posts" ? (
                <div role="tabpanel" id="mypage-panel-posts" aria-labelledby="mypage-tab-posts">
                  <MyPostsGrid page={page} onPageChange={onPageChange} />
                </div>
              ) : null}
              {tab === "commented" ? (
                <div role="tabpanel" id="mypage-panel-commented" aria-labelledby="mypage-tab-commented">
                  <CommentedPostsGrid page={page} onPageChange={onPageChange} />
                </div>
              ) : null}
              {tab === "campaigns" ? (
                <div role="tabpanel" id="mypage-panel-campaigns" aria-labelledby="mypage-tab-campaigns">
                  <UserCampaignsList mode="joined" page={page} onPageChange={onPageChange} />
                </div>
              ) : null}
              {tab === "created" ? (
                <div role="tabpanel" id="mypage-panel-created" aria-labelledby="mypage-tab-created">
                  <UserCampaignsList mode="created" page={page} onPageChange={onPageChange} />
                </div>
              ) : null}
              {tab === "saved" ? (
                <div role="tabpanel" id="mypage-panel-saved" aria-labelledby="mypage-tab-saved" className="space-y-12">
                  <section>
                    <h2 className="mb-6 text-[15px] font-medium" style={{ color: "var(--foreground)" }}>
                      저장한 게시글
                    </h2>
                    <SavedPostsGrid page={page} onPageChange={onPageChange} />
                  </section>
                  <section>
                    <h2 className="mb-6 text-[15px] font-medium" style={{ color: "var(--foreground)" }}>
                      저장한 캠페인
                    </h2>
                    <SavedCampaignsGrid page={savedCampaignPage} onPageChange={setSavedCampaignPage} />
                  </section>
                </div>
              ) : null}
              {tab === "account" ? (
                <div role="tabpanel" id="mypage-panel-account" aria-labelledby="mypage-tab-account">
                  <MypageAccountPanel
                    currentEmail={(displayedProfile ?? profile).email}
                    profileName={profile.name}
                    onEmailChanged={(email) => setEmailOverride({ userId: profile.id, email })}
                  />
                </div>
              ) : null}
              {tab === "access" ? (
                <div role="tabpanel" id="mypage-panel-access" aria-labelledby="mypage-tab-access">
                  <AccessLogsList page={page} onPageChange={onPageChange} />
                </div>
              ) : null}
              {tab === "reports" ? (
                <div role="tabpanel" id="mypage-panel-reports" aria-labelledby="mypage-tab-reports">
                  <ReportsList page={page} onPageChange={onPageChange} />
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

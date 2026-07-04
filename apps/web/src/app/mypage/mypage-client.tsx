"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { CheckCircle2, LogIn, Pencil, RefreshCw } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import type { UserProfile } from "@/data/users";
import { ActivitySummary } from "./activity-summary";
import { MyPostsGrid } from "./my-posts-grid";
import { SavedPostsGrid } from "./saved-posts-grid";
import { UserCampaignsList } from "./joined-campaigns-list";
import { ChangePasswordForm } from "./change-password-form";
import { ChangeEmailForm } from "./change-email-form";
import { DeleteAccountForm } from "./delete-account-form";
import { ReportsList } from "./reports-list";
import { Avatar } from "@/components/avatar";
import { StatePanel } from "@/components/ui/state-panel";

type Tab = "posts" | "campaigns" | "created" | "saved" | "reports";

const TABS: { id: Tab; label: string }[] = [
  { id: "posts", label: "내 게시글" },
  { id: "campaigns", label: "참여 캠페인" },
  { id: "created", label: "개설 캠페인" },
  { id: "saved", label: "저장됨" },
  { id: "reports", label: "신고 내역" },
];

const DEFAULT_TAB: Tab = "posts";

function parseTab(value: string | null): Tab {
  return TABS.some((t) => t.id === value) ? (value as Tab) : DEFAULT_TAB;
}

function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function ProfileHeader({ profile }: { profile: UserProfile }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 pb-10 pt-28 sm:flex-row sm:items-center sm:px-8 sm:pt-32">
      <div className="shrink-0 shadow-[0_25px_55px_-20px_rgba(0,0,0,0.55)]">
        <Avatar
          name={profile.name}
          verified={profile.verified}
          size={96}
          src={profile.profileImageUrl ?? undefined}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className="break-words"
            style={{
              fontFamily: "'Black Han Sans', sans-serif",
              fontSize: "clamp(32px, 6vw, 42px)",
              color: dark ? "#f9f7f2" : "#0f1f22",
            }}
          >
            {profile.name}
          </h1>
          {profile.verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#7dd3a3]/15 px-2.5 py-1 text-[11px] text-[#7dd3a3]">
              <CheckCircle2 size={12} /> 인증 사용자
            </span>
          ) : (
            <span
              className="rounded-full px-2.5 py-1 text-[11px]"
              style={{
                background: dark ? "rgba(255,255,255,0.07)" : "rgba(28,64,68,0.06)",
                color: dark ? "rgba(255,255,255,0.62)" : "rgba(28,64,68,0.62)",
              }}
            >
              일반 사용자
            </span>
          )}
        </div>
        <p className="mt-1 break-all text-[14px]" style={{ color: dark ? "rgba(255,255,255,0.68)" : "rgba(28,64,68,0.68)" }}>
          {profile.email}
        </p>
      </div>

      <Link
        href="/profile/edit"
        className="inline-flex self-start items-center gap-1.5 rounded-full px-4 py-2 text-[13px] transition-colors"
        style={{
          border: `1px solid ${dark ? "rgba(255,255,255,0.15)" : "rgba(28,64,68,0.15)"}`,
          color: dark ? "rgba(255,255,255,0.8)" : "rgba(28,64,68,0.8)",
        }}
      >
        <Pencil size={13} /> 프로필 편집
      </Link>
    </div>
  );
}

function Tabs({ tab, onSelect }: { tab: Tab; onSelect: (tab: Tab) => void }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div
      role="tablist"
      aria-label="마이페이지 콘텐츠"
      className="mx-auto flex max-w-5xl gap-1 overflow-x-auto border-b px-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-2 sm:px-8 [&::-webkit-scrollbar]:hidden"
      style={{ borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)" }}
    >
      {TABS.map((item) => {
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`mypage-tab-${item.id}`}
            aria-selected={active}
            aria-controls={`mypage-panel-${item.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(item.id)}
            className="relative shrink-0 px-4 py-3 text-[13px] transition-colors sm:px-6 sm:text-[14px]"
            style={{
              color: active
                ? dark ? "#f9f7f2" : "#0f1f22"
                : dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)",
              fontWeight: active ? 600 : 400,
            }}
          >
            {item.label}
            {active ? (
              <motion.div
                layoutId="mypage-tab-underline"
                className="absolute -bottom-px left-0 right-0 h-0.5"
                style={{ background: "#7dd3a3" }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default function MyPageClient() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile, loading, error, isLoggedIn, retry } = useCurrentUserProfile();
  const [emailOverride, setEmailOverride] = useState<{ userId: number; email: string } | null>(null);

  const tab = parseTab(searchParams.get("tab"));
  const page = parsePage(searchParams.get("page"));
  const displayedProfile = profile && emailOverride?.userId === profile.id
    ? { ...profile, email: emailOverride.email }
    : profile;

  const navigate = useCallback(
    (nextTab: Tab, nextPage: number) => {
      const params = new URLSearchParams();
      params.set("tab", nextTab);
      params.set("page", String(nextPage));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  // 탭 변경 시 해당 탭 page=0 으로 이동.
  const onSelectTab = useCallback((nextTab: Tab) => navigate(nextTab, 0), [navigate]);
  const onPageChange = useCallback((nextPage: number) => navigate(tab, nextPage), [navigate, tab]);

  return (
    <section
      className="relative min-h-screen overflow-hidden transition-colors"
      style={{
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute left-1/4 top-20 h-[500px] w-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <div className="relative pb-20">
        {/* loading을 먼저 확인: hydration 전(로그인 미확정)에 비로그인 패널이 깜빡이지 않도록. */}
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
            <ProfileHeader profile={displayedProfile ?? profile} />
            <ActivitySummary key={`summary-${profile.id}`} onSelectTab={onSelectTab} />
            <ChangeEmailForm
              currentEmail={(displayedProfile ?? profile).email}
              onChanged={(email) => setEmailOverride({ userId: profile.id, email })}
            />
            <ChangePasswordForm key={profile.id} profileName={profile.name} />
            <Tabs tab={tab} onSelect={onSelectTab} />
            <div className="mx-auto max-w-5xl px-6 py-10 sm:px-8">
              {tab === "posts" ? (
                <div role="tabpanel" id="mypage-panel-posts" aria-labelledby="mypage-tab-posts">
                  <MyPostsGrid page={page} onPageChange={onPageChange} />
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
                <div role="tabpanel" id="mypage-panel-saved" aria-labelledby="mypage-tab-saved">
                  <SavedPostsGrid page={page} onPageChange={onPageChange} />
                </div>
              ) : null}
              {tab === "reports" ? (
                <div role="tabpanel" id="mypage-panel-reports" aria-labelledby="mypage-tab-reports">
                  <ReportsList page={page} onPageChange={onPageChange} />
                </div>
              ) : null}
            </div>
            <DeleteAccountForm key={`delete-${profile.id}`} />
          </>
        )}
      </div>
    </section>
  );
}

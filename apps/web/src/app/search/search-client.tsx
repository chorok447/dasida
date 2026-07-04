"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bookmark,
  Heart,
  MessageCircle,
  RefreshCw,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { FallbackImage } from "@/components/fallback-image";
import { ActiveFilterChips, type FilterChip } from "@/components/active-filter-chips";
import { CampaignDateRangeFilterControls } from "@/components/campaign-date-range-filters";
import { ListEmptyState } from "@/components/list-empty-state";
import { SearchField } from "@/components/search-field";
import { ReportButton } from "@/components/report-button";
import { Pagination } from "@/components/ui/pagination";
import { PageShell } from "@/components/page-shell";
import { StaggerItem } from "@/components/scroll-reveal";
import { StatePanel } from "@/components/ui/state-panel";
import {
  appendCampaignDateRangeFilters,
  campaignDateRangeError,
  campaignRecruitMeta,
  EMPTY_CAMPAIGN_DATE_RANGE_FILTERS,
  readCampaignDateRangeFilters,
  type Campaign,
  type CampaignDateRangeFilters,
  type CampaignRecruitState,
  type CampaignSearchResponse,
} from "@/data/campaigns";
import type { Post, PostSearchResponse } from "@/data/posts";
import { ApiError, apiGet } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
import { progressPercent } from "@/lib/progress";
import { useAuthSession } from "@/lib/use-auth-session";
import { useTheme } from "@/lib/theme-context";
import { useCanonicalUrl, parsePageParam } from "@/lib/use-url-query";

type SearchType = "all" | "campaigns" | "posts";
type SearchSort = "latest" | "popular" | "deadline";

type UrlState = CampaignDateRangeFilters & {
  query: string;
  type: SearchType;
  sort: SearchSort;
  recruitState: CampaignRecruitState | null;
  availableOnly: boolean;
  page: number;
};

type ResultState = {
  identity: string;
  status: "loading" | "success" | "error";
  campaigns: CampaignSearchResponse | null;
  posts: PostSearchResponse | null;
  errorMessage: string | null;
};

const TYPE_TABS: { id: SearchType; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "campaigns", label: "캠페인" },
  { id: "posts", label: "게시글" },
];

function parseType(value: string | null): SearchType {
  return value === "campaigns" || value === "posts" ? value : "all";
}

function parseSort(value: string | null, type: SearchType): SearchSort {
  if (value === "popular") return "popular";
  if (value === "deadline" && type === "campaigns") return "deadline";
  return "latest";
}

function parsePage(value: string | null): number {
  return parsePageParam(value);
}

function parseRecruitState(value: string | null): CampaignRecruitState | null {
  return value === "before_recruit" || value === "recruiting" || value === "ended" || value === "closed"
    ? value
    : null;
}

function buildSearchHref(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  params.set("type", state.type);
  params.set("sort", state.sort);
  if (state.type === "campaigns") {
    if (state.recruitState) params.set("recruitState", state.recruitState);
    if (state.availableOnly) params.set("availableOnly", "true");
    appendCampaignDateRangeFilters(params, state);
  }
  params.set("page", state.page.toString());
  return `/search?${params.toString()}`;
}

function searchHasActiveFilters(state: UrlState): boolean {
  return !!(
    state.query
    || state.type !== "all"
    || state.sort !== "latest"
    || state.recruitState
    || state.availableOnly
    || state.recruitEndFrom
    || state.recruitEndTo
    || state.runStartFrom
    || state.runStartTo
  );
}

const RECRUIT_LABELS: Record<CampaignRecruitState, string> = {
  before_recruit: "모집 예정",
  recruiting: "모집 중",
  ended: "모집 종료",
  closed: "마감",
};

function buildSearchFilterChips(state: UrlState, onPatch: (changes: Partial<UrlState>) => void): FilterChip[] {
  const chips: FilterChip[] = [];
  if (state.query) chips.push({ id: "q", label: `검색: ${state.query}`, onRemove: () => onPatch({ query: "" }) });
  if (state.type !== "all") {
    const label = TYPE_TABS.find((tab) => tab.id === state.type)?.label ?? state.type;
    chips.push({ id: "type", label: `유형: ${label}`, onRemove: () => onPatch({ type: "all" }) });
  }
  if (state.sort !== "latest") {
    const sortLabel = state.sort === "popular" ? "인기순" : "마감임박순";
    chips.push({ id: "sort", label: `정렬: ${sortLabel}`, onRemove: () => onPatch({ sort: "latest" }) });
  }
  if (state.type === "campaigns") {
    if (state.recruitState) {
      chips.push({ id: "rs", label: `모집: ${RECRUIT_LABELS[state.recruitState]}`, onRemove: () => onPatch({ recruitState: null }) });
    }
    if (state.availableOnly) {
      chips.push({ id: "av", label: "참여 가능", onRemove: () => onPatch({ availableOnly: false }) });
    }
  }
  return chips;
}

function CampaignResultCard({ campaign }: { campaign: Campaign }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const progress = progressPercent(campaign.joined, campaign.capacity);
  const meta = campaignRecruitMeta(campaign);

  return (
    <div className="relative">
      <ReportButton
        targetType="CAMPAIGN"
        targetId={campaign.id}
        ownedByMe={campaign.ownedByMe}
        className="absolute left-3 top-3 z-20 !px-2.5 !py-1.5"
      />
      <Link
        href={`/campaigns/${campaign.id}`}
        className="group block overflow-hidden rounded-2xl border transition-transform hover:-translate-y-1"
        style={{
          background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
          borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
        }}
      >
        <div className="relative aspect-[16/9] overflow-hidden">
          {campaign.thumb ? (
            <FallbackImage
              src={campaign.thumb}
              alt={`${campaign.title} 캠페인 이미지`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#1c4044] to-[#148a90] text-[12px] text-white/70">
              캠페인 이미지 없음
            </div>
          )}
          <span
            className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] tracking-[0.15em]"
            style={{ background: meta.color, color: meta.fg }}
          >
            {meta.label}
          </span>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <h3 className="line-clamp-1 text-[17px] font-semibold" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              {campaign.title}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-6 opacity-65" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              {campaign.summary}
            </p>
          </div>
          <div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.08)" }}>
              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: meta.color }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              <span className="flex items-center gap-1.5">
                <Users size={12} /> {campaign.joined} / {campaign.capacity}명
              </span>
              <span>{campaign.daysLeftLabel}</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

function PostResultCard({ post }: { post: Post }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const image = post.images[0];

  return (
    <Link
      href={`/posts/${post.id}`}
      className="group overflow-hidden rounded-2xl border transition-transform hover:-translate-y-1"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <div className="flex items-center gap-3 p-4">
        <Avatar name={post.author.name} verified={post.author.verified} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
            {post.author.name}
          </p>
          <p className="text-[11px] opacity-50" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{post.time}</p>
        </div>
        {post.bookmarkedByMe ? <Bookmark size={15} fill="#7dd3a3" className="shrink-0 text-[#7dd3a3]" /> : null}
      </div>
      {image ? (
        <div className="aspect-[16/9] overflow-hidden">
          <FallbackImage
            src={image}
            alt="게시글 미리보기 이미지"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-[#1c4044] to-[#2d666c] px-6 text-center text-[13px] leading-6 text-white/75">
          {post.text.slice(0, 90)}
        </div>
      )}
      <div className="space-y-3 p-4">
        <p className="line-clamp-3 text-[14px] leading-6" style={{ color: dark ? "rgba(255,255,255,0.8)" : "rgba(28,64,68,0.82)" }}>
          {post.text}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {post.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-[#7dd3a3]/15 px-2 py-0.5 text-[10px] text-[#148a90]">{tag}</span>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t pt-3 text-[12px] opacity-65" style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)", color: dark ? "#f9f7f2" : "#0f1f22" }}>
          <span className="flex items-center gap-1" style={post.likedByMe ? { color: "#ed5c48" } : undefined}>
            <Heart size={13} fill={post.likedByMe ? "#ed5c48" : "none"} /> {post.likes}
          </span>
          <span className="flex items-center gap-1"><MessageCircle size={13} /> {post.comments}</span>
        </div>
      </div>
    </Link>
  );
}

export default function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessionId: token } = useAuthSession();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [retryTick, setRetryTick] = useState(0);
  const generationRef = useRef(0);

  const urlState = useMemo<UrlState>(() => {
    const type = parseType(searchParams.get("type"));
    return {
      query: (searchParams.get("q") ?? "").slice(0, 100),
      type,
      sort: parseSort(searchParams.get("sort"), type),
      recruitState: type === "campaigns" ? parseRecruitState(searchParams.get("recruitState")) : null,
      availableOnly: type === "campaigns" && searchParams.get("availableOnly") === "true",
      ...(type === "campaigns"
        ? readCampaignDateRangeFilters(searchParams)
        : EMPTY_CAMPAIGN_DATE_RANGE_FILTERS),
      page: parsePage(searchParams.get("page")),
    };
  }, [searchParams]);
  const canonicalHref = buildSearchHref(urlState);
  const currentHref = searchParams.toString() ? `/search?${searchParams.toString()}` : "/search";
  const dateFilterError = campaignDateRangeError(urlState);

  useCanonicalUrl(canonicalHref, currentHref);

  const requestIdentity = JSON.stringify([token, urlState, retryTick]);
  const [resultState, setResultState] = useState<ResultState>({
    identity: "",
    status: "loading",
    campaigns: null,
    posts: null,
    errorMessage: null,
  });
  const currentState: ResultState = resultState.identity === requestIdentity
    ? resultState
    : { identity: requestIdentity, status: "loading", campaigns: null, posts: null, errorMessage: null };

  const updateUrl = useCallback((changes: Partial<UrlState>, replace = false) => {
    const merged = { ...urlState, ...changes };
    const next: UrlState = merged.type === "campaigns"
      ? merged
      : {
          ...merged,
          sort: merged.sort === "deadline" ? "latest" : merged.sort,
          recruitState: null,
          availableOnly: false,
          ...EMPTY_CAMPAIGN_DATE_RANGE_FILTERS,
        };
    const href = buildSearchHref(next);
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [router, urlState]);

  const commitSearch = useCallback((query: string) => {
    updateUrl({ query: query.slice(0, 100), page: 0 }, true);
  }, [updateUrl]);

  useEffect(() => {
    const requestToken = token;
    if (getSessionId() !== requestToken) return;

    const campaignParams = new URLSearchParams();
    if (urlState.query) campaignParams.set("q", urlState.query);
    campaignParams.set("sort", urlState.sort);
    if (urlState.type === "campaigns" && urlState.recruitState) {
      campaignParams.set("recruitState", urlState.recruitState);
    }
    if (urlState.type === "campaigns" && urlState.availableOnly) {
      campaignParams.set("availableOnly", "true");
    }
    if (urlState.type === "campaigns") {
      appendCampaignDateRangeFilters(campaignParams, {
        recruitEndFrom: urlState.recruitEndFrom,
        recruitEndTo: urlState.recruitEndTo,
        runStartFrom: urlState.runStartFrom,
        runStartTo: urlState.runStartTo,
      });
    }
    campaignParams.set("page", urlState.page.toString());
    campaignParams.set("size", "6");
    const postParams = new URLSearchParams();
    if (urlState.query) postParams.set("q", urlState.query);
    postParams.set("sort", urlState.sort === "popular" ? "popular" : "latest");
    postParams.set("page", urlState.page.toString());
    postParams.set("size", "6");

    const generation = ++generationRef.current;
    let cancelled = false;
    const isCurrent = () =>
      !cancelled && generation === generationRef.current && getSessionId() === requestToken;

    const load = async () => {
      let campaigns: CampaignSearchResponse | null = null;
      let posts: PostSearchResponse | null = null;
      if (urlState.type === "all") {
        [campaigns, posts] = await Promise.all([
          apiGet<CampaignSearchResponse>(`/api/campaigns/search?${campaignParams.toString()}`),
          apiGet<PostSearchResponse>(`/api/posts/search?${postParams.toString()}`),
        ]);
      } else if (urlState.type === "campaigns") {
        campaigns = await apiGet<CampaignSearchResponse>(`/api/campaigns/search?${campaignParams.toString()}`);
      } else {
        posts = await apiGet<PostSearchResponse>(`/api/posts/search?${postParams.toString()}`);
      }
      if (!isCurrent()) return;
      setResultState({ identity: requestIdentity, status: "success", campaigns, posts, errorMessage: null });
    };

    load().catch((error) => {
      if (!isCurrent()) return;
      if (error instanceof ApiError && error.status === 401 && requestToken) {
        clearSession();
        return;
      }
      const errorMessage = error instanceof ApiError && error.status === 400
        ? dateFilterError ?? "날짜 형식이 올바르지 않습니다."
        : "검색 결과를 불러오지 못했습니다.";
      setResultState({
        identity: requestIdentity,
        status: "error",
        campaigns: null,
        posts: null,
        errorMessage,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    requestIdentity,
    token,
    dateFilterError,
    urlState.availableOnly,
    urlState.page,
    urlState.query,
    urlState.recruitEndFrom,
    urlState.recruitEndTo,
    urlState.recruitState,
    urlState.runStartFrom,
    urlState.runStartTo,
    urlState.sort,
    urlState.type,
  ]);

  const campaignResponse = currentState.campaigns;
  const postResponse = currentState.posts;
  const totalResults = (campaignResponse?.totalElements ?? 0) + (postResponse?.totalElements ?? 0);
  const allEmpty = urlState.type === "all"
    && campaignResponse?.content.length === 0
    && postResponse?.content.length === 0;
  const title = urlState.query ? `“${urlState.query}” 검색 결과` : "전체 탐색";
  const filterChips = buildSearchFilterChips(urlState, (changes) => updateUrl({ ...changes, page: 0 }));
  const resetFilters = () => updateUrl({
    query: "",
    type: "all",
    sort: "latest",
    recruitState: null,
    availableOnly: false,
    ...EMPTY_CAMPAIGN_DATE_RANGE_FILTERS,
    page: 0,
  });

  return (
    <PageShell paddingClassName="relative min-h-screen overflow-hidden px-5 pb-20 pt-28 sm:px-6 sm:pt-32" orb="left">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center sm:mb-10">
          <p className="mb-3 text-[11px] uppercase tracking-[0.4em]" style={{ color: dark ? "#7dd3a3" : "#1c4044" }}>Search</p>
          <h1 className="text-[36px] sm:text-[52px]" style={{ fontFamily: "'Black Han Sans', sans-serif", color: dark ? "#f9f7f2" : "#0f1f22" }}>
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[13px] leading-6 opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
            캠페인과 게시글을 한 번에 찾고, 원하는 결과만 골라볼 수 있습니다.
          </p>
        </div>

        <div className="mx-auto mb-8 max-w-3xl space-y-4">
          <SearchField
            key={urlState.query}
            value={urlState.query}
            onCommit={commitSearch}
            label="통합 검색"
            placeholder="캠페인과 게시글을 검색해보세요."
            loading={currentState.status === "loading"}
            className="rounded-full"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 overflow-x-auto rounded-full p-1" style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}>
              {TYPE_TABS.map((tab) => {
                const active = urlState.type === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updateUrl({ type: tab.id, page: 0 })}
                    className="shrink-0 rounded-full px-5 py-2 text-[13px]"
                    style={{ background: active ? "#7dd3a3" : "transparent", color: active ? "#0f1f22" : dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 self-end text-[13px] sm:self-auto">
              <span className="sr-only">검색 결과 정렬</span>
              <select
                value={urlState.sort}
                onChange={(event) => updateUrl({ sort: event.target.value as SearchSort, page: 0 })}
                className="rounded-full border px-4 py-2.5 outline-none"
                style={{ color: dark ? "#f9f7f2" : "#0f1f22", background: dark ? "#1c4044" : "#ffffff", borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(28,64,68,0.12)" }}
              >
                <option value="latest">최신순</option>
                <option value="popular">인기순</option>
                {urlState.type === "campaigns" ? <option value="deadline">마감임박순</option> : null}
              </select>
            </label>
          </div>
          {urlState.type === "campaigns" ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-[13px] sm:flex-none">
                  <span className="shrink-0 opacity-65">모집 상태</span>
                  <select
                    value={urlState.recruitState ?? ""}
                    onChange={(event) => updateUrl({
                      recruitState: event.target.value
                        ? event.target.value as CampaignRecruitState
                        : null,
                      page: 0,
                    })}
                    className="min-w-0 rounded-full border px-4 py-2.5 outline-none"
                    style={{ color: dark ? "#f9f7f2" : "#0f1f22", background: dark ? "#1c4044" : "#ffffff", borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(28,64,68,0.12)" }}
                  >
                    <option value="">전체</option>
                    <option value="before_recruit">모집 예정</option>
                    <option value="recruiting">모집 중</option>
                    <option value="ended">모집 종료</option>
                    <option value="closed">마감</option>
                  </select>
                </label>
                <label
                  className="flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px]"
                  style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}
                >
                  <input
                    type="checkbox"
                    checked={urlState.availableOnly}
                    onChange={(event) => updateUrl({ availableOnly: event.target.checked, page: 0 })}
                    className="accent-[#148a90]"
                  />
                  참여 가능
                </label>
              </div>
              <CampaignDateRangeFilterControls
                value={urlState}
                dark={dark}
                onChange={(field, value) => updateUrl({ [field]: value, page: 0 })}
                onClear={() => updateUrl({ ...EMPTY_CAMPAIGN_DATE_RANGE_FILTERS, page: 0 })}
              />
            </>
          ) : null}
          <ActiveFilterChips chips={filterChips} onClearAll={filterChips.length > 0 ? resetFilters : undefined} />
        </div>

        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-[13px] opacity-65" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
            {currentState.status === "success" ? `검색 결과 ${totalResults.toLocaleString()}개` : "검색 결과"}
          </p>
          <button
            type="button"
            aria-label="검색 결과 새로고침"
            onClick={() => setRetryTick((tick) => tick + 1)}
            disabled={currentState.status === "loading"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-45"
            style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.06)" }}
          >
            <RefreshCw size={16} className={currentState.status === "loading" ? "animate-spin" : ""} />
          </button>
        </div>

        {currentState.status === "loading" ? (
          <StatePanel>
            <RefreshCw size={28} className="animate-spin text-[#7dd3a3]" />
            <p style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>검색 결과를 불러오는 중입니다.</p>
          </StatePanel>
        ) : null}

        {currentState.status === "error" ? (
          <StatePanel>
            <p style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>
              {currentState.errorMessage ?? "검색 결과를 불러오지 못했습니다."}
            </p>
            <button type="button" onClick={() => setRetryTick((tick) => tick + 1)} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
              다시 시도
            </button>
          </StatePanel>
        ) : null}

        {currentState.status === "success" && allEmpty ? (
          <ListEmptyState
            title="검색 결과가 없어요."
            description="다른 검색어를 입력하거나 필터를 초기화해보세요."
            action={
              searchHasActiveFilters(urlState) ? (
                <button type="button" onClick={resetFilters} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] font-medium text-[#0f1f22]">
                  필터 초기화
                </button>
              ) : undefined
            }
          />
        ) : null}

        {currentState.status === "success" && urlState.type === "campaigns" && campaignResponse?.content.length === 0 ? (
          <ListEmptyState
            title="조건에 맞는 캠페인이 없어요."
            description="다른 검색어를 입력하거나 필터를 초기화해보세요."
            action={
              <button type="button" onClick={resetFilters} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] font-medium text-[#0f1f22]">
                전체 캠페인 보기
              </button>
            }
          />
        ) : null}

        {currentState.status === "success" && urlState.type === "posts" && postResponse?.content.length === 0 ? (
          <ListEmptyState
            title="조건에 맞는 게시글이 없어요."
            description="다른 검색어를 입력하거나 정렬을 바꿔보세요."
            action={
              <button type="button" onClick={resetFilters} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] font-medium text-[#0f1f22]">
                전체 게시글 보기
              </button>
            }
          />
        ) : null}

        {currentState.status === "success" && campaignResponse && campaignResponse.content.length > 0 ? (
          <section className="mb-12">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-[#148a90]">Campaigns</p>
                <h2 className="mt-1 text-[24px] font-semibold" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>캠페인</h2>
              </div>
              <span className="text-[12px] opacity-55" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{campaignResponse.totalElements.toLocaleString()}개</span>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {campaignResponse.content.map((campaign, i) => (
                <StaggerItem key={campaign.id} index={i}>
                  <CampaignResultCard campaign={campaign} />
                </StaggerItem>
              ))}
            </div>
            {urlState.type === "all" ? (
              <div className="mt-6 text-center">
                <button type="button" onClick={() => updateUrl({ type: "campaigns", page: 0 })} className="rounded-full border px-5 py-2.5 text-[13px]" style={{ borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(28,64,68,0.15)" }}>
                  캠페인 더 보기
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {currentState.status === "success" && postResponse && postResponse.content.length > 0 ? (
          <section>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-[#148a90]">Posts</p>
                <h2 className="mt-1 text-[24px] font-semibold" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>게시글</h2>
              </div>
              <span className="text-[12px] opacity-55" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{postResponse.totalElements.toLocaleString()}개</span>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {postResponse.content.map((post, i) => (
                <StaggerItem key={post.id} index={i}>
                  <PostResultCard post={post} />
                </StaggerItem>
              ))}
            </div>
            {urlState.type === "all" ? (
              <div className="mt-6 text-center">
                <button type="button" onClick={() => updateUrl({ type: "posts", page: 0 })} className="rounded-full border px-5 py-2.5 text-[13px]" style={{ borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(28,64,68,0.15)" }}>
                  게시글 더 보기
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {currentState.status === "success" && urlState.type === "campaigns" && campaignResponse ? (
          <Pagination
            page={campaignResponse.page}
            totalPages={campaignResponse.totalPages}
            totalElements={campaignResponse.totalElements}
            className="mt-10"
            onPageChange={(page) => updateUrl({ page })}
          />
        ) : null}

        {currentState.status === "success" && urlState.type === "posts" && postResponse ? (
          <Pagination
            page={postResponse.page}
            totalPages={postResponse.totalPages}
            totalElements={postResponse.totalElements}
            className="mt-10"
            onPageChange={(page) => updateUrl({ page })}
          />
        ) : null}

        {currentState.status === "success" && urlState.type === "all" && !allEmpty ? (
          <p className="mt-10 text-center text-[12px] opacity-50" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
            전체 검색은 캠페인과 게시글의 현재 페이지 결과를 각각 표시합니다.
          </p>
        ) : null}
      </div>
    </PageShell>
  );
}

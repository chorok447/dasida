"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import {
  appendCampaignDateRangeFilters,
  campaignDateRangeError,
  EMPTY_CAMPAIGN_DATE_RANGE_FILTERS,
  readCampaignDateRangeFilters,
  type CampaignSearchResponse,
} from "@/data/campaigns";
import type { PostSearchResponse } from "@/data/posts";
import { searchUsersPage, type PublicUserPageResponse } from "@/data/users";
import { ApiError, apiGet } from "@/lib/api";
import { getSessionId } from "@/lib/auth";
import { beginAuthedRequest, clearSessionIfUnauthorized, staleByIdentity } from "@/lib/authed-request";
import { useAuthSession } from "@/lib/use-auth-session";
import { useCanonicalUrl, parsePageParam } from "@/lib/use-url-query";
import {
  SearchFilters,
  buildSearchHref,
  parseSearchRecruitState,
  parseSearchSort,
  parseSearchTag,
  parseSearchType,
  type SearchUrlState,
} from "./search-filters";
import { SearchResults, type ResultState } from "./search-results";

export default function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessionId: token } = useAuthSession();
  const [retryTick, setRetryTick] = useState(0);
  const generationRef = useRef(0);

  const urlState = useMemo<SearchUrlState>(() => {
    const type = parseSearchType(searchParams.get("type"));
    return {
      query: (searchParams.get("q") ?? "").slice(0, 100),
      type,
      sort: parseSearchSort(searchParams.get("sort"), type),
      recruitState: type === "campaigns" ? parseSearchRecruitState(searchParams.get("recruitState")) : null,
      availableOnly: type === "campaigns" && searchParams.get("availableOnly") === "true",
      tag: parseSearchTag(searchParams.get("tag"), type),
      ...(type === "campaigns"
        ? readCampaignDateRangeFilters(searchParams)
        : EMPTY_CAMPAIGN_DATE_RANGE_FILTERS),
      page: parsePageParam(searchParams.get("page")),
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
    users: null,
    errorMessage: null,
  });
  const currentState = staleByIdentity(resultState, requestIdentity, {
    identity: requestIdentity,
    status: "loading",
    campaigns: null,
    posts: null,
    users: null,
    errorMessage: null,
  });

  const updateUrl = useCallback((changes: Partial<SearchUrlState>, replace = false) => {
    const merged = { ...urlState, ...changes };
    const next: SearchUrlState = merged.type === "campaigns"
      ? merged
      : {
          ...merged,
          sort: merged.type === "users" || merged.sort === "deadline" ? "latest" : merged.sort,
          recruitState: null,
          availableOnly: false,
          tag: merged.type === "users" ? "" : merged.tag,
          ...EMPTY_CAMPAIGN_DATE_RANGE_FILTERS,
        };
    const href = buildSearchHref(next);
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [router, urlState]);

  const resetFilters = () => updateUrl({
    query: "",
    type: "all",
    sort: "latest",
    recruitState: null,
    availableOnly: false,
    tag: "",
    ...EMPTY_CAMPAIGN_DATE_RANGE_FILTERS,
    page: 0,
  });

  useEffect(() => {
    if (getSessionId() !== token) return;

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
    if (urlState.tag) postParams.set("tag", urlState.tag);
    postParams.set("sort", urlState.sort === "popular" ? "popular" : "latest");
    postParams.set("page", urlState.page.toString());
    postParams.set("size", "6");

    const guard = beginAuthedRequest(generationRef, token);

    const load = async () => {
      let campaigns: CampaignSearchResponse | null = null;
      let posts: PostSearchResponse | null = null;
      let users: PublicUserPageResponse | null = null;
      if (urlState.type === "all") {
        [campaigns, posts, users] = await Promise.all([
          apiGet<CampaignSearchResponse>(`/api/campaigns/search?${campaignParams.toString()}`),
          apiGet<PostSearchResponse>(`/api/posts/search?${postParams.toString()}`),
          // 사용자는 이름 검색만 지원 → 검색어가 있을 때만 함께 조회한다.
          urlState.query ? searchUsersPage(urlState.query, urlState.page, 6) : Promise.resolve(null),
        ]);
      } else if (urlState.type === "campaigns") {
        campaigns = await apiGet<CampaignSearchResponse>(`/api/campaigns/search?${campaignParams.toString()}`);
      } else if (urlState.type === "users") {
        users = await searchUsersPage(urlState.query, urlState.page, 12);
      } else {
        posts = await apiGet<PostSearchResponse>(`/api/posts/search?${postParams.toString()}`);
      }
      if (!guard.isCurrent()) return;
      setResultState({ identity: requestIdentity, status: "success", campaigns, posts, users, errorMessage: null });
    };

    load().catch((error) => {
      if (!guard.isCurrent()) return;
      if (clearSessionIfUnauthorized(error, token)) return;
      const errorMessage = error instanceof ApiError && error.status === 400
        ? dateFilterError ?? "날짜 형식이 올바르지 않습니다."
        : "검색 결과를 불러오지 못했습니다.";
      setResultState({
        identity: requestIdentity,
        status: "error",
        campaigns: null,
        posts: null,
        users: null,
        errorMessage,
      });
    });

    return guard.cancel;
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
    urlState.tag,
    urlState.type,
  ]);

  const title = urlState.query
    ? `“${urlState.query}” 검색 결과`
    : urlState.tag
      ? `${urlState.tag} 태그 게시글`
      : "전체 탐색";

  return (
    <PageShell paddingClassName="relative min-h-screen overflow-hidden px-5 pb-20 pt-28 sm:px-6 sm:pt-32" orb="left">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center sm:mb-10">
          <p className="mb-3 text-[11px] uppercase tracking-[0.4em]" style={{ color: "var(--accent)" }}>Search</p>
          <h1
            className="text-[36px] sm:text-[52px]"
            style={{ fontFamily: "var(--font-black-han), sans-serif", color: "var(--foreground)" }}
          >
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[13px] leading-6 opacity-60" style={{ color: "var(--foreground)" }}>
            캠페인, 게시글, 사용자를 한 번에 찾고, 원하는 결과만 골라볼 수 있습니다.
          </p>
        </div>

        <SearchFilters
          state={urlState}
          loading={currentState.status === "loading"}
          onUpdate={updateUrl}
          onReset={resetFilters}
        />

        <SearchResults
          urlState={urlState}
          currentState={currentState}
          onRetry={() => setRetryTick((tick) => tick + 1)}
          onUpdate={(changes) => updateUrl(changes)}
          onReset={resetFilters}
        />
      </div>
    </PageShell>
  );
}

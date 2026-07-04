"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useScroll, useTransform } from "motion/react";
import { ListEmptyState } from "@/components/list-empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import { StaggerItem } from "@/components/scroll-reveal";
import { SkeletonCards } from "@/components/ui/skeleton-cards";
import {
  appendCampaignDateRangeFilters,
  campaignDateRangeError,
  readCampaignDateRangeFilters,
  type CampaignSearchResponse,
} from "@/data/campaigns";
import { getSessionId } from "@/lib/auth";
import { ApiError, apiGet } from "@/lib/api";
import { beginAuthedRequest, clearSessionIfUnauthorized, staleByIdentity } from "@/lib/authed-request";
import { useAuthSession } from "@/lib/use-auth-session";
import {
  useCanonicalUrl,
  parsePageParam,
  buildCampaignsHref,
  type CampaignListUrlState,
} from "@/lib/use-url-query";
import { PageShell } from "@/components/page-shell";
import { CampaignListCard } from "./campaign-list-cards";
import {
  CampaignListFilters,
  campaignHasActiveFilters,
  EMPTY_CAMPAIGN_DATE_RANGE_FILTERS,
  parseCampaignListFilter,
  parseCampaignListRecruitState,
  parseCampaignListSort,
} from "./campaign-list-filters";

type SearchState = {
  identity: string;
  status: "loading" | "success" | "error";
  response: CampaignSearchResponse | null;
  errorMessage: string | null;
};

export default function CampaignListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessionId: token } = useAuthSession();
  const [retryTick, setRetryTick] = useState(0);
  const generationRef = useRef(0);

  const urlState = useMemo<CampaignListUrlState>(() => ({
    query: searchParams.get("q") ?? "",
    filter: parseCampaignListFilter(searchParams.get("status")),
    recruitState: parseCampaignListRecruitState(searchParams.get("recruitState")),
    availableOnly: searchParams.get("availableOnly") === "true",
    ...readCampaignDateRangeFilters(searchParams),
    sort: parseCampaignListSort(searchParams.get("sort")),
    page: parsePageParam(searchParams.get("page")),
  }), [searchParams]);

  const canonicalHref = buildCampaignsHref(urlState);
  const currentHref = searchParams.toString() ? `/campaigns?${searchParams.toString()}` : "/campaigns";
  const dateFilterError = campaignDateRangeError(urlState);

  useCanonicalUrl(canonicalHref, currentHref);
  const requestIdentity = JSON.stringify([token, urlState, retryTick]);
  const [searchState, setSearchState] = useState<SearchState>({
    identity: "",
    status: "loading",
    response: null,
    errorMessage: null,
  });
  const currentState = staleByIdentity(searchState, requestIdentity, {
    identity: requestIdentity,
    status: "loading",
    response: null,
    errorMessage: null,
  });

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const titleY = useTransform(scrollY, [0, 600], [0, -80]);

  const updateUrl = useCallback((changes: Partial<CampaignListUrlState>, replace = false) => {
    const href = buildCampaignsHref({ ...urlState, ...changes });
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [router, urlState]);

  const commitSearch = useCallback((query: string) => {
    updateUrl({ query, page: 0 }, true);
  }, [updateUrl]);

  useEffect(() => {
    if (getSessionId() !== token) return;

    const params = new URLSearchParams();
    if (urlState.query) params.set("q", urlState.query);
    if (urlState.filter !== "all") params.set("status", urlState.filter);
    if (urlState.recruitState) params.set("recruitState", urlState.recruitState);
    params.set("availableOnly", urlState.availableOnly.toString());
    appendCampaignDateRangeFilters(params, {
      recruitEndFrom: urlState.recruitEndFrom,
      recruitEndTo: urlState.recruitEndTo,
      runStartFrom: urlState.runStartFrom,
      runStartTo: urlState.runStartTo,
    });
    params.set("sort", urlState.sort);
    params.set("page", urlState.page.toString());
    params.set("size", "9");

    const guard = beginAuthedRequest(generationRef, token);

    apiGet<CampaignSearchResponse>(`/api/campaigns/search?${params.toString()}`)
      .then((response) => {
        if (!guard.isCurrent()) return;
        setSearchState({ identity: requestIdentity, status: "success", response, errorMessage: null });
      })
      .catch((error) => {
        if (!guard.isCurrent()) return;
        if (clearSessionIfUnauthorized(error, token)) return;
        const errorMessage = error instanceof ApiError && error.status === 400
          ? dateFilterError ?? "날짜 형식이 올바르지 않습니다."
          : "캠페인을 불러오지 못했습니다.";
        setSearchState({ identity: requestIdentity, status: "error", response: null, errorMessage });
      });

    return guard.cancel;
  }, [
    requestIdentity,
    token,
    dateFilterError,
    urlState.availableOnly,
    urlState.filter,
    urlState.page,
    urlState.query,
    urlState.recruitEndFrom,
    urlState.recruitEndTo,
    urlState.recruitState,
    urlState.runStartFrom,
    urlState.runStartTo,
    urlState.sort,
  ]);

  const response = currentState.response;
  const resetFilters = () => updateUrl({
    query: "",
    filter: "all",
    recruitState: null,
    availableOnly: false,
    sort: "latest",
    ...EMPTY_CAMPAIGN_DATE_RANGE_FILTERS,
    page: 0,
  });

  return (
    <PageShell ref={sectionRef} paddingClassName="relative min-h-screen overflow-hidden px-6 pb-20 pt-32" orb="right">
      <div className="relative mx-auto max-w-6xl">
        <motion.div className="mb-12 text-center" style={{ y: titleY }}>
          <p className="mb-3 uppercase tracking-[0.4em]" style={{ color: "var(--accent)", fontSize: 11 }}>
            Campaigns
          </p>
          <h1
            style={{
              fontFamily: "'Black Han Sans', sans-serif",
              fontSize: "clamp(48px, 6vw, 96px)",
              color: "var(--foreground)",
            }}
          >
            함께 만드는 작은 변화
          </h1>
          <p className="mx-auto mt-4 max-w-xl" style={{ color: "var(--foreground-muted)" }}>
            모집중인 캠페인에 참여하거나, 다가올 캠페인을 미리 둘러보세요.
          </p>
        </motion.div>

        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-[13px]" style={{ color: "var(--foreground-muted)" }}>
            {currentState.status === "success" && response ? `검색 결과 ${response.totalElements.toLocaleString()}개` : "캠페인 검색"}
          </p>
          <button
            type="button"
            onClick={() => router.push("/campaigns/new")}
            className="shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-transform hover:-translate-y-0.5"
            style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
          >
            + 캠페인 만들기
          </button>
        </div>

        <CampaignListFilters
          state={urlState}
          loading={currentState.status === "loading"}
          onFilter={(filter) => updateUrl({ filter, page: 0 })}
          onSearch={commitSearch}
          onSort={(sort) => updateUrl({ sort, page: 0 })}
          onRecruitState={(recruitState) => updateUrl({ recruitState, page: 0 })}
          onAvailableOnly={(availableOnly) => updateUrl({ availableOnly, page: 0 })}
          onDateChange={(field, value) => updateUrl({ [field]: value, page: 0 })}
          onClearDates={() => updateUrl({ ...EMPTY_CAMPAIGN_DATE_RANGE_FILTERS, page: 0 })}
          onPatch={(changes) => updateUrl(changes)}
          onResetAll={resetFilters}
        />

        {currentState.status === "loading" ? (
          <SkeletonCards count={6} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" />
        ) : null}

        {currentState.status === "error" ? (
          <StatePanel>
            <p style={{ color: "var(--foreground-muted)" }}>
              {currentState.errorMessage ?? "캠페인을 불러오지 못했습니다."}
            </p>
            <button
              type="button"
              onClick={() => setRetryTick((tick) => tick + 1)}
              className="rounded-full px-5 py-2 text-[13px]"
              style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
            >
              다시 시도
            </button>
          </StatePanel>
        ) : null}

        {currentState.status === "success" && response?.content.length === 0 ? (
          <ListEmptyState
            title={campaignHasActiveFilters(urlState) ? "조건에 맞는 캠페인이 없어요." : "아직 등록된 캠페인이 없어요."}
            description={
              campaignHasActiveFilters(urlState)
                ? "다른 검색어를 입력하거나 필터를 초기화해보세요."
                : "첫 캠페인을 만들거나 잠시 후 다시 확인해보세요."
            }
            action={
              campaignHasActiveFilters(urlState) ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-full px-5 py-2 text-[13px] font-medium"
                  style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
                >
                  전체 캠페인 보기
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push("/campaigns/new")}
                  className="rounded-full px-5 py-2 text-[13px] font-medium"
                  style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
                >
                  캠페인 만들기
                </button>
              )
            }
          />
        ) : null}

        {currentState.status === "success" && response && response.content.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {response.content.map((campaign, i) => (
              <StaggerItem key={campaign.id} index={i}>
                <CampaignListCard
                  campaign={campaign}
                  onOpen={() => router.push(`/campaigns/${campaign.id}`)}
                />
              </StaggerItem>
            ))}
          </div>
        ) : null}

        {currentState.status === "success" && response && response.totalElements > 0 ? (
          <Pagination
            page={response.page}
            totalPages={response.totalPages}
            totalElements={response.totalElements}
            className="mt-10"
            onPageChange={(page) => updateUrl({ page })}
          />
        ) : null}
      </div>
    </PageShell>
  );
}

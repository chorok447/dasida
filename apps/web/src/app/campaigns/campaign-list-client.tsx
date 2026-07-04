"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { Calendar, Users } from "lucide-react";
import { CampaignDateRangeFilterControls } from "@/components/campaign-date-range-filters";
import { ActiveFilterChips, type FilterChip } from "@/components/active-filter-chips";
import { ListEmptyState } from "@/components/list-empty-state";
import { SearchField } from "@/components/search-field";
import { ReportButton } from "@/components/report-button";
import { FallbackImage } from "@/components/fallback-image";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import { StaggerItem } from "@/components/scroll-reveal";
import { SkeletonCards } from "@/components/ui/skeleton-cards";
import {
  appendCampaignDateRangeFilters,
  campaignDateRangeError,
  campaignRecruitMeta,
  EMPTY_CAMPAIGN_DATE_RANGE_FILTERS,
  readCampaignDateRangeFilters,
  type Campaign,
  type CampaignDateRangeField,
  type CampaignDateRangeFilters,
  type CampaignRecruitState,
  type CampaignSearchResponse,
  type CampaignSearchSort,
  type CampaignStatus,
} from "@/data/campaigns";
import { clearSession, getSessionId } from "@/lib/auth";
import { ApiError, apiGet } from "@/lib/api";
import { useAuthSession } from "@/lib/use-auth-session";
import { useTheme } from "@/lib/theme-context";
import { progressPercent } from "@/lib/progress";

type Filter = "all" | CampaignStatus;
type SearchState = {
  identity: string;
  status: "loading" | "success" | "error";
  response: CampaignSearchResponse | null;
  errorMessage: string | null;
};
type UrlState = CampaignDateRangeFilters & {
  query: string;
  filter: Filter;
  recruitState: CampaignRecruitState | null;
  availableOnly: boolean;
  sort: CampaignSearchSort;
  page: number;
};

const FILTER_ITEMS: { id: Filter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "open", label: "모집중" },
  { id: "upcoming", label: "모집예정" },
  { id: "closed", label: "모집마감" },
];

function StatusBadge({ campaign }: { campaign: Campaign }) {
  const meta = campaignRecruitMeta(campaign);
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px] tracking-[0.2em]"
      style={{ background: meta.color, color: meta.fg }}
    >
      {meta.label}
    </span>
  );
}

function ProgressBar({ campaign }: { campaign: Campaign }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const pct = progressPercent(campaign.joined, campaign.capacity);
  const meta = campaignRecruitMeta(campaign);
  return (
    <div className="w-full">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.08)" }}
      >
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: meta.color }}
        />
      </div>
      <div
        className="mt-1.5 flex justify-between text-[11px]"
        style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}
      >
        <span>
          {campaign.capacity > 0 ? (
            <>
              <b style={{ color: meta.color }}>{campaign.joined}</b> / {campaign.capacity}명
            </>
          ) : (
            "모집 인원 미정"
          )}
        </span>
        <span>{meta.label}</span>
      </div>
    </div>
  );
}

function CampaignCard({ campaign, onOpen }: { campaign: Campaign; onOpen: () => void }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const ref = useRef<HTMLButtonElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 200, damping: 22 });
  const springY = useSpring(mouseY, { stiffness: 200, damping: 22 });
  const rotateY = useTransform(springX, [-0.5, 0.5], [-12, 12]);
  const rotateX = useTransform(springY, [-0.5, 0.5], [10, -10]);

  return (
    <div className="relative" style={{ perspective: 1000 }}>
      <ReportButton
        targetType="CAMPAIGN"
        targetId={campaign.id}
        ownedByMe={campaign.ownedByMe}
        className="absolute left-3 top-3 z-20 bg-[#0f1f22]/75 !text-white backdrop-blur-sm"
      />
      <motion.button
        type="button"
        ref={ref}
        onMouseMove={(event) => {
          const rect = ref.current?.getBoundingClientRect();
          if (!rect) return;
          mouseX.set((event.clientX - rect.left) / rect.width - 0.5);
          mouseY.set((event.clientY - rect.top) / rect.height - 0.5);
        }}
        onMouseLeave={() => {
          mouseX.set(0);
          mouseY.set(0);
        }}
        onClick={onOpen}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="w-full cursor-pointer overflow-hidden rounded-2xl border text-left shadow-[0_20px_50px_-25px_rgba(0,0,0,0.5)]"
      >
        <div
          style={{
            background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
            borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
          }}
          className="border-0"
        >
          <div className="relative aspect-[4/3] overflow-hidden">
            <FallbackImage
              src={campaign.thumb}
              alt={`${campaign.title} 캠페인 이미지`}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1f22]/70 via-transparent to-transparent" />
            <div className="absolute right-3 top-3" style={{ transform: "translateZ(40px)" }}>
              <StatusBadge campaign={campaign} />
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 text-[12px] text-white/90">
              <Calendar size={12} />
              <span>{campaign.recruitStart} ~ {campaign.recruitEnd}</span>
            </div>
          </div>
          <div className="space-y-3 p-5">
            <h3
              style={{
                fontFamily: "'Black Han Sans', sans-serif",
                fontSize: 22,
                color: dark ? "#f9f7f2" : "#0f1f22",
                lineHeight: 1.25,
              }}
            >
              {campaign.title}
            </h3>
            <p
              className="line-clamp-2 text-[13px]"
              style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}
            >
              {campaign.summary}
            </p>
            <ProgressBar campaign={campaign} />
            <div
              className="flex items-center justify-between pt-1 text-[12px]"
              style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}
            >
              <span className="flex items-center gap-1.5">
                <Users size={12} /> 모집 {campaign.capacity}명
              </span>
              <span>{campaign.daysLeftLabel}</span>
            </div>
          </div>
        </div>
      </motion.button>
    </div>
  );
}

const RECRUIT_STATE_LABELS: Record<CampaignRecruitState, string> = {
  before_recruit: "모집 예정",
  recruiting: "모집 중",
  ended: "모집 종료",
  closed: "마감",
};

function campaignHasActiveFilters(state: UrlState): boolean {
  return !!(
    state.query
    || state.filter !== "all"
    || state.recruitState
    || state.availableOnly
    || state.recruitEndFrom
    || state.recruitEndTo
    || state.runStartFrom
    || state.runStartTo
  );
}

function buildCampaignFilterChips(
  state: UrlState,
  onPatch: (changes: Partial<UrlState>) => void,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (state.query) {
    chips.push({
      id: "q",
      label: `검색: ${state.query}`,
      onRemove: () => onPatch({ query: "" }),
    });
  }
  if (state.filter !== "all") {
    const label = FILTER_ITEMS.find((item) => item.id === state.filter)?.label ?? state.filter;
    chips.push({
      id: "status",
      label: `상태: ${label}`,
      onRemove: () => onPatch({ filter: "all" }),
    });
  }
  if (state.recruitState) {
    chips.push({
      id: "recruitState",
      label: `모집: ${RECRUIT_STATE_LABELS[state.recruitState]}`,
      onRemove: () => onPatch({ recruitState: null }),
    });
  }
  if (state.availableOnly) {
    chips.push({
      id: "availableOnly",
      label: "참여 가능",
      onRemove: () => onPatch({ availableOnly: false }),
    });
  }
  if (state.recruitEndFrom || state.recruitEndTo) {
    chips.push({
      id: "recruitEnd",
      label: `모집 마감 ${state.recruitEndFrom || "…"}~${state.recruitEndTo || "…"}`,
      onRemove: () => onPatch({ recruitEndFrom: "", recruitEndTo: "" }),
    });
  }
  if (state.runStartFrom || state.runStartTo) {
    chips.push({
      id: "runStart",
      label: `진행 시작 ${state.runStartFrom || "…"}~${state.runStartTo || "…"}`,
      onRemove: () => onPatch({ runStartFrom: "", runStartTo: "" }),
    });
  }
  if (state.sort !== "latest") {
    const sortLabel = state.sort === "popular" ? "인기순" : "마감임박순";
    chips.push({
      id: "sort",
      label: `정렬: ${sortLabel}`,
      onRemove: () => onPatch({ sort: "latest" }),
    });
  }
  return chips;
}

function FilterBar({
  state,
  loading,
  onFilter,
  onSearch,
  onSort,
  onRecruitState,
  onAvailableOnly,
  onDateChange,
  onClearDates,
  onPatch,
  onResetAll,
}: {
  state: UrlState;
  loading: boolean;
  onFilter: (filter: Filter) => void;
  onSearch: (query: string) => void;
  onSort: (sort: CampaignSearchSort) => void;
  onRecruitState: (recruitState: CampaignRecruitState | null) => void;
  onAvailableOnly: (checked: boolean) => void;
  onDateChange: (field: CampaignDateRangeField, value: string) => void;
  onClearDates: () => void;
  onPatch: (changes: Partial<UrlState>) => void;
  onResetAll: () => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const chips = buildCampaignFilterChips(state, (changes) => onPatch({ ...changes, page: 0 }));

  return (
    <div className="mb-8 space-y-4">
      <div className="flex w-full gap-1 overflow-x-auto rounded-full p-1 md:w-fit" style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}>
        {FILTER_ITEMS.map((item) => {
          const active = state.filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onFilter(item.id)}
              className="relative shrink-0 rounded-full px-5 py-2 text-[13px]"
              style={{ color: active ? "#0f1f22" : dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}
            >
              {active ? (
                <motion.div layoutId="filter-pill" className="absolute inset-0 rounded-full" style={{ background: "#7dd3a3" }} />
              ) : null}
              <span className="relative">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchField
          key={state.query}
          value={state.query}
          onCommit={onSearch}
          label="캠페인 검색"
          placeholder="캠페인 제목·요약 검색..."
          loading={loading}
          className="rounded-full"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px]">
            <span className="shrink-0 opacity-65">모집 상태</span>
            <select
              value={state.recruitState ?? ""}
              onChange={(event) => onRecruitState(
                event.target.value ? event.target.value as CampaignRecruitState : null,
              )}
              className="rounded-full border px-4 py-2.5 outline-none"
              style={{
                color: dark ? "#f9f7f2" : "#0f1f22",
                background: dark ? "#1c4044" : "#ffffff",
                borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(28,64,68,0.12)",
              }}
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
              checked={state.availableOnly}
              onChange={(event) => onAvailableOnly(event.target.checked)}
              className="accent-[#148a90]"
            />
            참여 가능
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <span className="sr-only">정렬</span>
            <select
              value={state.sort}
              onChange={(event) => onSort(event.target.value as CampaignSearchSort)}
              className="rounded-full border px-4 py-2.5 outline-none"
              style={{
                color: dark ? "#f9f7f2" : "#0f1f22",
                background: dark ? "#1c4044" : "#ffffff",
                borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(28,64,68,0.12)",
              }}
            >
              <option value="latest">최신순</option>
              <option value="popular">인기순</option>
              <option value="deadline">마감임박순</option>
            </select>
          </label>
        </div>
      </div>
      <CampaignDateRangeFilterControls
        value={state}
        dark={dark}
        onChange={onDateChange}
        onClear={onClearDates}
      />
      <ActiveFilterChips chips={chips} onClearAll={chips.length > 0 ? onResetAll : undefined} />
    </div>
  );
}

function parsePage(value: string | null): number {
  if (value === null) return 0;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function parseFilter(value: string | null): Filter {
  return value === "open" || value === "upcoming" || value === "closed" ? value : "all";
}

function parseRecruitState(value: string | null): CampaignRecruitState | null {
  return value === "before_recruit" || value === "recruiting" || value === "ended" || value === "closed"
    ? value
    : null;
}

function parseSort(value: string | null): CampaignSearchSort {
  return value === "popular" || value === "deadline" ? value : "latest";
}

function buildCampaignsHref(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.filter !== "all") params.set("status", state.filter);
  if (state.recruitState) params.set("recruitState", state.recruitState);
  if (state.availableOnly) params.set("availableOnly", "true");
  appendCampaignDateRangeFilters(params, state);
  params.set("sort", state.sort);
  params.set("page", state.page.toString());
  return `/campaigns?${params.toString()}`;
}

export default function CampaignListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessionId: token } = useAuthSession();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [retryTick, setRetryTick] = useState(0);
  const generationRef = useRef(0);

  const urlState = useMemo<UrlState>(() => ({
    query: searchParams.get("q") ?? "",
    filter: parseFilter(searchParams.get("status")),
    recruitState: parseRecruitState(searchParams.get("recruitState")),
    availableOnly: searchParams.get("availableOnly") === "true",
    ...readCampaignDateRangeFilters(searchParams),
    sort: parseSort(searchParams.get("sort")),
    page: parsePage(searchParams.get("page")),
  }), [searchParams]);
  const canonicalHref = buildCampaignsHref(urlState);
  const currentHref = searchParams.toString() ? `/campaigns?${searchParams.toString()}` : "/campaigns";
  const dateFilterError = campaignDateRangeError(urlState);

  useEffect(() => {
    if (currentHref !== canonicalHref) router.replace(canonicalHref, { scroll: false });
  }, [canonicalHref, currentHref, router]);
  const requestIdentity = JSON.stringify([token, urlState, retryTick]);
  const [searchState, setSearchState] = useState<SearchState>({
    identity: "",
    status: "loading",
    response: null,
    errorMessage: null,
  });
  const currentState: SearchState = searchState.identity === requestIdentity
    ? searchState
    : { identity: requestIdentity, status: "loading", response: null, errorMessage: null };

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const titleY = useTransform(scrollY, [0, 600], [0, -80]);

  const updateUrl = useCallback((changes: Partial<UrlState>, replace = false) => {
    const next = { ...urlState, ...changes };
    const href = buildCampaignsHref(next);
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [router, urlState]);

  const commitSearch = useCallback((query: string) => {
    updateUrl({ query, page: 0 }, true);
  }, [updateUrl]);

  useEffect(() => {
    const requestToken = token;
    if (getSessionId() !== requestToken) return;

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

    const generation = ++generationRef.current;
    let cancelled = false;
    const isCurrent = () =>
      !cancelled && generation === generationRef.current && getSessionId() === requestToken;

    apiGet<CampaignSearchResponse>(`/api/campaigns/search?${params.toString()}`)
      .then((response) => {
        if (!isCurrent()) return;
        setSearchState({ identity: requestIdentity, status: "success", response, errorMessage: null });
      })
      .catch((error) => {
        if (!isCurrent()) return;
        if (error instanceof ApiError && error.status === 401 && requestToken) {
          clearSession();
          return;
        }
        const errorMessage = error instanceof ApiError && error.status === 400
          ? dateFilterError ?? "날짜 형식이 올바르지 않습니다."
          : "캠페인을 불러오지 못했습니다.";
        setSearchState({ identity: requestIdentity, status: "error", response: null, errorMessage });
      });

    return () => {
      cancelled = true;
    };
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

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen overflow-hidden px-6 pb-20 pt-32 transition-colors"
      style={{
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute right-1/4 top-20 h-[500px] w-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <motion.div className="mb-12 text-center" style={{ y: titleY }}>
          <p className="mb-3 uppercase tracking-[0.4em]" style={{ color: dark ? "#7dd3a3" : "#1c4044", fontSize: 11 }}>
            Campaigns
          </p>
          <h1
            style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: "clamp(48px, 6vw, 96px)", color: dark ? "#f9f7f2" : "#0f1f22" }}
          >
            함께 만드는 작은 변화
          </h1>
          <p className="mx-auto mt-4 max-w-xl" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
            모집중인 캠페인에 참여하거나, 다가올 캠페인을 미리 둘러보세요.
          </p>
        </motion.div>

        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>
            {currentState.status === "success" && response ? `검색 결과 ${response.totalElements.toLocaleString()}개` : "캠페인 검색"}
          </p>
          <button
            type="button"
            onClick={() => router.push("/campaigns/new")}
            className="shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-transform hover:-translate-y-0.5"
            style={{ background: "#7dd3a3", color: "#0f1f22" }}
          >
            + 캠페인 만들기
          </button>
        </div>

        <FilterBar
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
          onResetAll={() => updateUrl({
            query: "",
            filter: "all",
            recruitState: null,
            availableOnly: false,
            sort: "latest",
            ...EMPTY_CAMPAIGN_DATE_RANGE_FILTERS,
            page: 0,
          })}
        />

        {currentState.status === "loading" ? (
          <SkeletonCards count={6} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" />
        ) : null}

        {currentState.status === "error" ? (
          <StatePanel>
            <p style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>
              {currentState.errorMessage ?? "캠페인을 불러오지 못했습니다."}
            </p>
            <button
              type="button"
              onClick={() => setRetryTick((tick) => tick + 1)}
              className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]"
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
                  onClick={() => updateUrl({
                    query: "",
                    filter: "all",
                    recruitState: null,
                    availableOnly: false,
                    sort: "latest",
                    ...EMPTY_CAMPAIGN_DATE_RANGE_FILTERS,
                    page: 0,
                  })}
                  className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] font-medium text-[#0f1f22]"
                >
                  전체 캠페인 보기
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push("/campaigns/new")}
                  className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] font-medium text-[#0f1f22]"
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
                <CampaignCard
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
    </section>
  );
}

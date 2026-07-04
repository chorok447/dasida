"use client";

import { ActiveFilterChips, type FilterChip } from "@/components/active-filter-chips";
import { CampaignDateRangeFilterControls } from "@/components/campaign-date-range-filters";
import { SearchField } from "@/components/search-field";
import {
  EMPTY_CAMPAIGN_DATE_RANGE_FILTERS,
  appendCampaignDateRangeFilters,
  type CampaignDateRangeFilters,
  type CampaignRecruitState,
} from "@/data/campaigns";
import { useTheme } from "@/lib/theme-context";

export type SearchType = "all" | "campaigns" | "posts";
export type SearchSort = "latest" | "popular" | "deadline";

export type SearchUrlState = CampaignDateRangeFilters & {
  query: string;
  type: SearchType;
  sort: SearchSort;
  recruitState: CampaignRecruitState | null;
  availableOnly: boolean;
  page: number;
};

const TYPE_TABS: { id: SearchType; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "campaigns", label: "캠페인" },
  { id: "posts", label: "게시글" },
];

const RECRUIT_LABELS: Record<CampaignRecruitState, string> = {
  before_recruit: "모집 예정",
  recruiting: "모집 중",
  ended: "모집 종료",
  closed: "마감",
};

export function searchHasActiveFilters(state: SearchUrlState): boolean {
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

export function buildSearchFilterChips(
  state: SearchUrlState,
  onPatch: (changes: Partial<SearchUrlState>) => void,
): FilterChip[] {
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

export function SearchFilters({
  state,
  loading,
  onUpdate,
  onReset,
}: {
  state: SearchUrlState;
  loading: boolean;
  onUpdate: (changes: Partial<SearchUrlState>, replace?: boolean) => void;
  onReset: () => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const filterChips = buildSearchFilterChips(state, (changes) => onUpdate({ ...changes, page: 0 }));

  return (
    <div className="mx-auto mb-8 max-w-3xl space-y-4">
      <SearchField
        key={state.query}
        value={state.query}
        onCommit={(query) => onUpdate({ query: query.slice(0, 100), page: 0 }, true)}
        label="통합 검색"
        placeholder="캠페인과 게시글을 검색해보세요."
        loading={loading}
        className="rounded-full"
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex gap-1 overflow-x-auto rounded-full p-1"
          style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}
        >
          {TYPE_TABS.map((tab) => {
            const active = state.type === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => onUpdate({ type: tab.id, page: 0 })}
                className="shrink-0 rounded-full px-5 py-2 text-[13px]"
                style={{
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--surface-dark)" : "var(--foreground-muted)",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 self-end text-[13px] sm:self-auto">
          <span className="sr-only">검색 결과 정렬</span>
          <select
            value={state.sort}
            onChange={(event) => onUpdate({ sort: event.target.value as SearchSort, page: 0 })}
            className="rounded-full border px-4 py-2.5 outline-none"
            style={{ color: "var(--foreground)", background: "var(--card)", borderColor: "var(--border)" }}
          >
            <option value="latest">최신순</option>
            <option value="popular">인기순</option>
            {state.type === "campaigns" ? <option value="deadline">마감임박순</option> : null}
          </select>
        </label>
      </div>
      {state.type === "campaigns" ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-[13px] sm:flex-none">
              <span className="shrink-0 opacity-65">모집 상태</span>
              <select
                value={state.recruitState ?? ""}
                onChange={(event) => onUpdate({
                  recruitState: event.target.value ? event.target.value as CampaignRecruitState : null,
                  page: 0,
                })}
                className="min-w-0 rounded-full border px-4 py-2.5 outline-none"
                style={{ color: "var(--foreground)", background: "var(--card)", borderColor: "var(--border)" }}
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
                onChange={(event) => onUpdate({ availableOnly: event.target.checked, page: 0 })}
                className="accent-[#148a90]"
              />
              참여 가능
            </label>
          </div>
          <CampaignDateRangeFilterControls
            value={state}
            dark={dark}
            onChange={(field, value) => onUpdate({ [field]: value, page: 0 })}
            onClear={() => onUpdate({ ...EMPTY_CAMPAIGN_DATE_RANGE_FILTERS, page: 0 })}
          />
        </>
      ) : null}
      <ActiveFilterChips chips={filterChips} onClearAll={filterChips.length > 0 ? onReset : undefined} />
    </div>
  );
}

export function parseSearchType(value: string | null): SearchType {
  return value === "campaigns" || value === "posts" ? value : "all";
}

export function parseSearchSort(value: string | null, type: SearchType): SearchSort {
  if (value === "popular") return "popular";
  if (value === "deadline" && type === "campaigns") return "deadline";
  return "latest";
}

export function parseSearchRecruitState(value: string | null): CampaignRecruitState | null {
  return value === "before_recruit" || value === "recruiting" || value === "ended" || value === "closed"
    ? value
    : null;
}

export function buildSearchHref(state: SearchUrlState): string {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  params.set("type", state.type);
  params.set("sort", state.sort);
  if (state.type === "campaigns") {
    if (state.recruitState) params.set("recruitState", state.recruitState);
    if (state.availableOnly) params.set("availableOnly", "true");
    appendCampaignDateRangeFilters(params, {
      recruitEndFrom: state.recruitEndFrom,
      recruitEndTo: state.recruitEndTo,
      runStartFrom: state.runStartFrom,
      runStartTo: state.runStartTo,
    });
  }
  params.set("page", state.page.toString());
  return `/search?${params.toString()}`;
}

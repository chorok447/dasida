"use client";

import { motion } from "motion/react";
import { CampaignDateRangeFilterControls } from "@/components/campaign-date-range-filters";
import { ActiveFilterChips, type FilterChip } from "@/components/active-filter-chips";
import { SearchField } from "@/components/search-field";
import {
  EMPTY_CAMPAIGN_DATE_RANGE_FILTERS,
  type CampaignDateRangeField,
  type CampaignRecruitState,
  type CampaignSearchSort,
  type CampaignStatus,
} from "@/data/campaigns";
import type { CampaignListUrlState } from "@/lib/use-url-query";

export type CampaignListFilter = "all" | CampaignStatus;

const FILTER_ITEMS: { id: CampaignListFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "open", label: "모집중" },
  { id: "upcoming", label: "모집예정" },
  { id: "closed", label: "모집마감" },
];

const RECRUIT_STATE_LABELS: Record<CampaignRecruitState, string> = {
  before_recruit: "모집 예정",
  recruiting: "모집 중",
  ended: "모집 종료",
  closed: "마감",
};

export function campaignHasActiveFilters(state: CampaignListUrlState): boolean {
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
  state: CampaignListUrlState,
  onPatch: (changes: Partial<CampaignListUrlState>) => void,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (state.query) {
    chips.push({ id: "q", label: `검색: ${state.query}`, onRemove: () => onPatch({ query: "" }) });
  }
  if (state.filter !== "all") {
    const label = FILTER_ITEMS.find((item) => item.id === state.filter)?.label ?? state.filter;
    chips.push({ id: "status", label: `상태: ${label}`, onRemove: () => onPatch({ filter: "all" }) });
  }
  if (state.recruitState) {
    chips.push({
      id: "recruitState",
      label: `모집: ${RECRUIT_STATE_LABELS[state.recruitState]}`,
      onRemove: () => onPatch({ recruitState: null }),
    });
  }
  if (state.availableOnly) {
    chips.push({ id: "availableOnly", label: "참여 가능", onRemove: () => onPatch({ availableOnly: false }) });
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
    chips.push({ id: "sort", label: `정렬: ${sortLabel}`, onRemove: () => onPatch({ sort: "latest" }) });
  }
  return chips;
}

export function CampaignListFilters({
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
  state: CampaignListUrlState;
  loading: boolean;
  onFilter: (filter: CampaignListFilter) => void;
  onSearch: (query: string) => void;
  onSort: (sort: CampaignSearchSort) => void;
  onRecruitState: (recruitState: CampaignRecruitState | null) => void;
  onAvailableOnly: (checked: boolean) => void;
  onDateChange: (field: CampaignDateRangeField, value: string) => void;
  onClearDates: () => void;
  onPatch: (changes: Partial<CampaignListUrlState>) => void;
  onResetAll: () => void;
}) {
  const chips = buildCampaignFilterChips(state, (changes) => onPatch({ ...changes, page: 0 }));

  return (
    <div className="mb-8 space-y-4">
      <div
        className="flex w-full gap-1 overflow-x-auto rounded-full p-1 md:w-fit"
        style={{ background: "rgba(var(--ink-rgb), 0.06)" }}
      >
        {FILTER_ITEMS.map((item) => {
          const active = state.filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onFilter(item.id)}
              className="relative shrink-0 rounded-full px-5 py-2 text-[13px]"
              style={{ color: active ? "var(--surface-dark)" : "var(--foreground-muted)" }}
            >
              {active ? (
                <motion.div layoutId="filter-pill" className="absolute inset-0 rounded-full" style={{ background: "var(--accent)" }} />
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
              className="rounded-full border px-4 py-2.5 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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
            style={{ background: "rgba(var(--ink-rgb), 0.06)" }}
          >
            <input
              type="checkbox"
              checked={state.availableOnly}
              onChange={(event) => onAvailableOnly(event.target.checked)}
              className="accent-[var(--accent-strong)]"
            />
            참여 가능
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <span className="sr-only">정렬</span>
            <select
              value={state.sort}
              onChange={(event) => onSort(event.target.value as CampaignSearchSort)}
              className="rounded-full border px-4 py-2.5 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              style={{ color: "var(--foreground)", background: "var(--card)", borderColor: "var(--border)" }}
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
        onChange={onDateChange}
        onClear={onClearDates}
      />
      <ActiveFilterChips chips={chips} onClearAll={chips.length > 0 ? onResetAll : undefined} />
    </div>
  );
}

export function parseCampaignListFilter(value: string | null): CampaignListFilter {
  return value === "open" || value === "upcoming" || value === "closed" ? value : "all";
}

export function parseCampaignListRecruitState(value: string | null): CampaignRecruitState | null {
  return value === "before_recruit" || value === "recruiting" || value === "ended" || value === "closed"
    ? value
    : null;
}

export function parseCampaignListSort(value: string | null): CampaignSearchSort {
  return value === "popular" || value === "deadline" ? value : "latest";
}

export { EMPTY_CAMPAIGN_DATE_RANGE_FILTERS };

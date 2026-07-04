"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  appendCampaignDateRangeFilters,
  type CampaignDateRangeFilters,
  type CampaignRecruitState,
  type CampaignSearchSort,
  type CampaignStatus,
} from "@/data/campaigns";
import type { PostSearchSort } from "@/data/posts";

export type FeedUrlState = {
  query: string;
  campaignOnly: boolean;
  sort: PostSearchSort;
  page: number;
};

export type CampaignListUrlState = CampaignDateRangeFilters & {
  query: string;
  filter: "all" | CampaignStatus;
  recruitState: CampaignRecruitState | null;
  availableOnly: boolean;
  sort: CampaignSearchSort;
  page: number;
};

/** 피드 목록 URL을 canonical 형태로 만든다. */
export function buildFeedHref(state: FeedUrlState): string {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.campaignOnly) params.set("campaignOnly", "true");
  params.set("sort", state.sort);
  params.set("page", state.page.toString());
  return `/feed?${params.toString()}`;
}

/** 캠페인 목록 URL을 canonical 형태로 만든다. */
export function buildCampaignsHref(state: CampaignListUrlState): string {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.filter !== "all") params.set("status", state.filter);
  if (state.recruitState) params.set("recruitState", state.recruitState);
  if (state.availableOnly) params.set("availableOnly", "true");
  appendCampaignDateRangeFilters(params, {
    recruitEndFrom: state.recruitEndFrom,
    recruitEndTo: state.recruitEndTo,
    runStartFrom: state.runStartFrom,
    runStartTo: state.runStartTo,
  });
  params.set("sort", state.sort);
  params.set("page", state.page.toString());
  return `/campaigns?${params.toString()}`;
}

/** URL 쿼리를 canonical href로 정규화한다. */
export function useCanonicalUrl(canonicalHref: string, currentHref: string) {
  const router = useRouter();

  useEffect(() => {
    if (currentHref !== canonicalHref) router.replace(canonicalHref, { scroll: false });
  }, [canonicalHref, currentHref, router]);
}

export function parsePageParam(value: string | null): number {
  if (value === null) return 0;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

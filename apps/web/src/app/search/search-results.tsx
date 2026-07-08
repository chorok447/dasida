"use client";

import { RefreshCw } from "lucide-react";
import { ListEmptyState } from "@/components/list-empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import { StaggerItem } from "@/components/scroll-reveal";
import type { CampaignSearchResponse } from "@/data/campaigns";
import type { PostSearchResponse } from "@/data/posts";
import type { PublicUserPageResponse } from "@/data/users";
import { CampaignResultCard, PostResultCard, UserResultCard } from "./search-result-cards";
import type { SearchUrlState } from "./search-filters";
import { searchHasActiveFilters } from "./search-filters";

type ResultState = {
  identity: string;
  status: "loading" | "success" | "error";
  campaigns: CampaignSearchResponse | null;
  posts: PostSearchResponse | null;
  users: PublicUserPageResponse | null;
  errorMessage: string | null;
};

export function SearchResults({
  urlState,
  currentState,
  onRetry,
  onUpdate,
  onReset,
}: {
  urlState: SearchUrlState;
  currentState: ResultState;
  onRetry: () => void;
  onUpdate: (changes: Partial<SearchUrlState>) => void;
  onReset: () => void;
}) {

  const campaignResponse = currentState.campaigns;
  const postResponse = currentState.posts;
  const userResponse = currentState.users;
  const totalResults = (campaignResponse?.totalElements ?? 0)
    + (postResponse?.totalElements ?? 0)
    + (userResponse?.totalElements ?? 0);
  const allEmpty = urlState.type === "all"
    && campaignResponse?.content.length === 0
    && postResponse?.content.length === 0
    && (userResponse === null || userResponse.content.length === 0);

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[13px] opacity-65" style={{ color: "var(--foreground)" }}>
          {currentState.status === "success" ? `검색 결과 ${totalResults.toLocaleString()}개` : "검색 결과"}
        </p>
        <button
          type="button"
          aria-label="검색 결과 새로고침"
          onClick={onRetry}
          disabled={currentState.status === "loading"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-45"
          style={{ background: "rgba(var(--ink-rgb), 0.07)" }}
        >
          <RefreshCw size={16} className={currentState.status === "loading" ? "animate-spin" : ""} />
        </button>
      </div>

      {currentState.status === "loading" ? (
        <StatePanel>
          <RefreshCw size={28} className="animate-spin text-[var(--accent)]" />
          <p style={{ color: "var(--foreground-muted)" }}>검색 결과를 불러오는 중입니다.</p>
        </StatePanel>
      ) : null}

      {currentState.status === "error" ? (
        <StatePanel>
          <p style={{ color: "var(--foreground-muted)" }}>
            {currentState.errorMessage ?? "검색 결과를 불러오지 못했습니다."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full px-5 py-2 text-[13px]"
            style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
          >
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
              <button
                type="button"
                onClick={onReset}
                className="rounded-full px-5 py-2 text-[13px] font-medium"
                style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
              >
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
            <button
              type="button"
              onClick={onReset}
              className="rounded-full px-5 py-2 text-[13px] font-medium"
              style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
            >
              전체 캠페인 보기
            </button>
          }
        />
      ) : null}

      {currentState.status === "success" && urlState.type === "users" && !urlState.query ? (
        <ListEmptyState
          title="이름으로 사용자를 찾아보세요."
          description="검색창에 닉네임을 입력하면 사용자를 검색할 수 있어요."
        />
      ) : null}

      {currentState.status === "success" && urlState.type === "users" && urlState.query
        && userResponse?.content.length === 0 ? (
          <ListEmptyState
            title="조건에 맞는 사용자가 없어요."
            description="다른 이름으로 검색해보세요."
          />
        ) : null}

      {currentState.status === "success" && urlState.type === "posts" && postResponse?.content.length === 0 ? (
        <ListEmptyState
          title="조건에 맞는 게시글이 없어요."
          description="다른 검색어를 입력하거나 정렬을 바꿔보세요."
          action={
            <button
              type="button"
              onClick={onReset}
              className="rounded-full px-5 py-2 text-[13px] font-medium"
              style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
            >
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
              <h2 className="mt-1 text-[24px] font-semibold" style={{ color: "var(--foreground)" }}>캠페인</h2>
            </div>
            <span className="text-[12px] opacity-55" style={{ color: "var(--foreground)" }}>
              {campaignResponse.totalElements.toLocaleString()}개
            </span>
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
              <button
                type="button"
                onClick={() => onUpdate({ type: "campaigns", page: 0 })}
                className="rounded-full border px-5 py-2.5 text-[13px]"
                style={{ borderColor: "var(--border)" }}
              >
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
              <h2 className="mt-1 text-[24px] font-semibold" style={{ color: "var(--foreground)" }}>게시글</h2>
            </div>
            <span className="text-[12px] opacity-55" style={{ color: "var(--foreground)" }}>
              {postResponse.totalElements.toLocaleString()}개
            </span>
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
              <button
                type="button"
                onClick={() => onUpdate({ type: "posts", page: 0 })}
                className="rounded-full border px-5 py-2.5 text-[13px]"
                style={{ borderColor: "var(--border)" }}
              >
                게시글 더 보기
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {currentState.status === "success" && userResponse && userResponse.content.length > 0 ? (
        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-[#148a90]">Users</p>
              <h2 className="mt-1 text-[24px] font-semibold" style={{ color: "var(--foreground)" }}>사용자</h2>
            </div>
            <span className="text-[12px] opacity-55" style={{ color: "var(--foreground)" }}>
              {userResponse.totalElements.toLocaleString()}명
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {userResponse.content.map((user, i) => (
              <StaggerItem key={user.id} index={i}>
                <UserResultCard user={user} />
              </StaggerItem>
            ))}
          </div>
          {urlState.type === "all" ? (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => onUpdate({ type: "users", page: 0 })}
                className="rounded-full border px-5 py-2.5 text-[13px]"
                style={{ borderColor: "var(--border)" }}
              >
                사용자 더 보기
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
          onPageChange={(page) => onUpdate({ page })}
        />
      ) : null}

      {currentState.status === "success" && urlState.type === "posts" && postResponse ? (
        <Pagination
          page={postResponse.page}
          totalPages={postResponse.totalPages}
          totalElements={postResponse.totalElements}
          className="mt-10"
          onPageChange={(page) => onUpdate({ page })}
        />
      ) : null}

      {currentState.status === "success" && urlState.type === "users" && userResponse ? (
        <Pagination
          page={userResponse.page}
          totalPages={userResponse.totalPages}
          totalElements={userResponse.totalElements}
          className="mt-10"
          onPageChange={(page) => onUpdate({ page })}
        />
      ) : null}

      {currentState.status === "success" && urlState.type === "all" && !allEmpty ? (
        <p className="mt-10 text-center text-[12px] opacity-50" style={{ color: "var(--foreground)" }}>
          전체 검색은 캠페인·게시글·사용자의 현재 페이지 결과를 각각 표시합니다.
        </p>
      ) : null}
    </>
  );
}

export type { ResultState };

"use client";

import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { getSessionId, PROFILE_EVENT } from "@/lib/auth";
import { beginAuthedRequest, clearSessionIfUnauthorized } from "@/lib/authed-request";
import { useAuthSession } from "@/lib/use-auth-session";
import { CurrentUserAvatar } from "@/components/current-user-avatar";
import { PageShell } from "@/components/page-shell";
import { FeedPostCard } from "@/app/feed/feed-post-card";
import { FeedSideHot, FeedSideRecommend } from "@/app/feed/feed-sidebar";
import { FeedControls, feedHasActiveFilters } from "@/app/feed/feed-controls";
import { ListEmptyState } from "@/components/list-empty-state";
import { StaggerItem } from "@/components/scroll-reveal";
import { SkeletonCards } from "@/components/ui/skeleton-cards";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import type { PostSearchResponse } from "@/data/posts";
import type { Campaign } from "@/data/campaigns";
import { useCanonicalUrl, parsePageParam, buildFeedHref, type FeedUrlState } from "@/lib/use-url-query";

type UrlState = FeedUrlState;

type SearchState = {
  identity: string;
  queryIdentity: string;
  token: string | null;
  status: "loading" | "success" | "error";
  response: PostSearchResponse | null;
};

function neutralizeInteractions(response: PostSearchResponse): PostSearchResponse {
  return {
    ...response,
    content: response.content.map((post) => ({
      ...post,
      likedByMe: false,
      bookmarkedByMe: false,
      ownedByMe: false,
    })),
  };
}

export default function FeedClient({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessionId: token } = useAuthSession();
  const [retryTick, setRetryTick] = useState(0);
  const generationRef = useRef(0);

  useEffect(() => {
    const onProfileUpdated = () => setRetryTick((tick) => tick + 1);
    window.addEventListener(PROFILE_EVENT, onProfileUpdated);
    return () => window.removeEventListener(PROFILE_EVENT, onProfileUpdated);
  }, []);

  const urlState = useMemo<UrlState>(() => {
    const sort = searchParams.get("sort");
    return {
      query: searchParams.get("q") ?? "",
      campaignOnly: searchParams.get("campaignOnly") === "true",
      followingOnly: searchParams.get("followingOnly") === "true",
      sort: sort === "popular" || sort === "discussed" || sort === "views" ? sort : "latest",
      page: parsePageParam(searchParams.get("page")),
    };
  }, [searchParams]);
  const canonicalHref = buildFeedHref(urlState);
  const currentHref = searchParams.toString() ? `/feed?${searchParams.toString()}` : "/feed";
  useCanonicalUrl(canonicalHref, currentHref);
  const queryIdentity = JSON.stringify(urlState);
  const requestIdentity = JSON.stringify([token, queryIdentity, retryTick]);
  const [searchState, setSearchState] = useState<SearchState>({
    identity: "",
    queryIdentity: "",
    token: null,
    status: "loading",
    response: null,
  });
  const requestIsCurrent = searchState.identity === requestIdentity;
  const response = useMemo(() => {
    if (requestIsCurrent) return searchState.response;
    if (searchState.queryIdentity !== queryIdentity || !searchState.response) return null;
    return searchState.token === token
      ? searchState.response
      : neutralizeInteractions(searchState.response);
  }, [queryIdentity, requestIsCurrent, searchState.queryIdentity, searchState.response, searchState.token, token]);
  const requestStatus = requestIsCurrent ? searchState.status : "loading";
  const refreshing = requestStatus === "loading";

  const updateUrl = useCallback((changes: Partial<UrlState>, replace = false) => {
    const next = { ...urlState, ...changes };
    const href = buildFeedHref(next);
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [router, urlState]);

  const commitSearch = useCallback((query: string) => {
    updateUrl({ query, page: 0 }, true);
  }, [updateUrl]);

  const goToNewPost = () => {
    if (!getSessionId()) {
      toast.error("로그인 후 글을 작성할 수 있어요.");
      router.push("/login?next=/posts/new");
      return;
    }
    router.push("/posts/new");
  };

  const searchPath = useMemo(() => {
    const params = new URLSearchParams();
    if (urlState.query) params.set("q", urlState.query);
    if (urlState.campaignOnly) params.set("campaignOnly", "true");
    if (urlState.followingOnly && token) params.set("followingOnly", "true");
    params.set("sort", urlState.sort);
    params.set("page", urlState.page.toString());
    params.set("size", "10");
    return `/api/posts/search?${params.toString()}`;
  }, [token, urlState.campaignOnly, urlState.followingOnly, urlState.page, urlState.query, urlState.sort]);

  useEffect(() => {
    if (!token && urlState.followingOnly) {
      updateUrl({ followingOnly: false }, true);
    }
  }, [token, updateUrl, urlState.followingOnly]);

  useEffect(() => {
    const requestToken = token;
    if (getSessionId() !== requestToken) return;

    const guard = beginAuthedRequest(generationRef, requestToken);

    apiGet<PostSearchResponse>(searchPath)
      .then((nextResponse) => {
        if (!guard.isCurrent()) return;
        setSearchState({
          identity: requestIdentity,
          queryIdentity,
          token: requestToken,
          status: "success",
          response: nextResponse,
        });
      })
      .catch((error) => {
        if (!guard.isCurrent()) return;
        if (clearSessionIfUnauthorized(error, requestToken)) return;
        setSearchState((previous) => {
          const previousResponse = previous.queryIdentity === queryIdentity ? previous.response : null;
          const fallback = previousResponse && previous.token !== requestToken
            ? neutralizeInteractions(previousResponse)
            : previousResponse;
          return {
            identity: requestIdentity,
            queryIdentity,
            token: requestToken,
            status: "error",
            response: fallback,
          };
        });
      });

    return guard.cancel;
  }, [queryIdentity, requestIdentity, searchPath, token]);

  return (
    <PageShell paddingClassName="relative min-h-screen pt-28 pb-20 px-6 overflow-hidden" orb="left">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main>
          <h1 className="sr-only">피드</h1>
          <button
            type="button"
            onClick={goToNewPost}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border mb-6 hover:-translate-y-0.5 transition-transform text-left"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <CurrentUserAvatar />
            <span className="flex-1 opacity-60" style={{ color: "var(--foreground)" }}>
              지금 어떤 업사이클을 하고 있나요?
            </span>
            <span className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-full" style={{ background: "var(--accent)", color: "var(--surface-dark)" }}>
              <ImageIcon size={14} /> 새 글
            </span>
          </button>

          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-[13px]" style={{ color: "var(--foreground-muted)" }}>
              {response ? `검색 결과 ${response.totalElements.toLocaleString()}개` : "게시글 검색"}
            </p>
            <button
              type="button"
              aria-label="피드 새로고침"
              onClick={() => setRetryTick((tick) => tick + 1)}
              disabled={refreshing}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-45"
              style={{ background: "rgba(var(--ink-rgb), 0.07)" }}
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>

          <FeedControls
            state={urlState}
            loading={refreshing}
            onSearch={commitSearch}
            onSort={(sort) => updateUrl({ sort, page: 0 })}
            onCampaignOnly={(campaignOnly) => updateUrl({ campaignOnly, page: 0 })}
            onFollowingOnly={token ? (followingOnly) => updateUrl({ followingOnly, page: 0 }) : undefined}
            onPatch={(changes) => updateUrl(changes)}
            onResetAll={() => updateUrl({ query: "", campaignOnly: false, followingOnly: false, sort: "latest", page: 0 })}
          />

          {requestStatus === "loading" && !response ? (
            <SkeletonCards count={4} className="grid grid-cols-1 gap-5 sm:grid-cols-2" />
          ) : null}

          {requestStatus === "error" && !response ? (
            <StatePanel>
              <p style={{ color: "var(--foreground-muted)" }}>게시글을 불러오지 못했습니다.</p>
              <button
                type="button"
                onClick={() => setRetryTick((tick) => tick + 1)}
                className="rounded-full bg-[var(--accent)] px-5 py-2 text-[13px] text-[var(--surface-dark)]"
              >
                다시 시도
              </button>
            </StatePanel>
          ) : null}

          {requestStatus === "error" && response ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgba(var(--danger-rgb),0.25)] px-4 py-3 text-[12px] text-[var(--danger)]">
              <span>최신 게시글을 불러오지 못해 이전 결과를 표시합니다.</span>
              <button type="button" onClick={() => setRetryTick((tick) => tick + 1)} className="underline underline-offset-4">
                다시 시도
              </button>
            </div>
          ) : null}

          {requestStatus === "success" && response?.content.length === 0 ? (
            <ListEmptyState
              title={feedHasActiveFilters(urlState) ? "검색 결과가 없어요." : "아직 게시글이 없어요."}
              description={
                feedHasActiveFilters(urlState)
                  ? urlState.followingOnly
                    ? "팔로우한 작성자의 게시글이 없어요."
                    : "다른 검색어를 입력하거나 필터를 초기화해보세요."
                  : "첫 업사이클 이야기를 남겨보세요."
              }
              action={
                feedHasActiveFilters(urlState) ? (
                  <button
                    type="button"
                    onClick={() => updateUrl({ query: "", campaignOnly: false, followingOnly: false, sort: "latest", page: 0 })}
                    className="rounded-full bg-[var(--accent)] px-5 py-2 text-[13px] font-medium text-[var(--surface-dark)]"
                  >
                    전체 게시글 보기
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goToNewPost}
                    className="rounded-full bg-[var(--accent)] px-5 py-2 text-[13px] font-medium text-[var(--surface-dark)]"
                  >
                    새 글 작성
                  </button>
                )
              }
            />
          ) : null}

          {response && response.content.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {response.content.map((post, i) => (
                <StaggerItem key={post.id} index={i}>
                  <FeedPostCard
                    p={post}
                    refreshing={refreshing}
                    identity={token}
                    onOpen={() => router.push(`/posts/${post.id}`)}
                  />
                </StaggerItem>
              ))}
            </div>
          ) : null}

          {response && response.totalElements > 0 ? (
            <Pagination
              page={response.page}
              totalPages={response.totalPages}
              totalElements={response.totalElements}
              disabled={refreshing}
              className="mt-8"
              onPageChange={(page) => updateUrl({ page })}
            />
          ) : null}
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-5">
            <FeedSideHot campaigns={campaigns} />
            <FeedSideRecommend />
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

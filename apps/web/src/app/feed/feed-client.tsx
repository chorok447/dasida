"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import {
  Bookmark,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Share2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { progressPercent } from "@/lib/progress";
import { apiGet, apiPost, apiDelete, ApiError } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { Avatar } from "@/components/avatar";
import { ReportButton } from "@/components/report-button";
import { StaggerItem } from "@/components/scroll-reveal";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import type { Post, PostComment, PostSearchResponse, PostSearchSort } from "@/data/posts";
import { statusMeta, type Campaign } from "@/data/campaigns";

const MAX_COMMENT_LENGTH = 500;

type UrlState = {
  query: string;
  campaignOnly: boolean;
  sort: PostSearchSort;
  page: number;
};

type SearchState = {
  identity: string;
  queryIdentity: string;
  token: string | null;
  status: "loading" | "success" | "error";
  response: PostSearchResponse | null;
};

function parsePage(value: string | null): number {
  if (value === null) return 0;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

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

function DebouncedSearchInput({ value, onCommit }: { value: string; onCommit: (query: string) => void }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    const normalized = draft.trim();
    if (normalized === value) return;
    const timeout = window.setTimeout(() => onCommit(normalized), 300);
    return () => window.clearTimeout(timeout);
  }, [draft, onCommit, value]);

  return (
    <label
      className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-4 py-2.5"
      style={{
        background: dark ? "rgba(255,255,255,0.06)" : "#ffffff",
        border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)"}`,
      }}
    >
      <Search size={16} className="shrink-0 opacity-50" />
      <span className="sr-only">게시글 검색</span>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={100}
        placeholder="본문 또는 작성자 검색..."
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:opacity-50"
        style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
      />
    </label>
  );
}

function FeedControls({
  state,
  onSearch,
  onSort,
  onCampaignOnly,
}: {
  state: UrlState;
  onSearch: (query: string) => void;
  onSort: (sort: PostSearchSort) => void;
  onCampaignOnly: (checked: boolean) => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <div className="mb-6 flex flex-col gap-3">
      <DebouncedSearchInput key={state.query} value={state.query} onCommit={onSearch} />
      <div className="flex flex-wrap items-center gap-3">
        <label
          className="flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px]"
          style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}
        >
          <input
            type="checkbox"
            checked={state.campaignOnly}
            onChange={(event) => onCampaignOnly(event.target.checked)}
            className="accent-[#148a90]"
          />
          캠페인 게시글만
        </label>
        <label className="ml-auto flex items-center gap-2 text-[13px]">
          <span className="sr-only">게시글 정렬</span>
          <select
            value={state.sort}
            onChange={(event) => onSort(event.target.value as PostSearchSort)}
            className="rounded-full border px-4 py-2.5 outline-none"
            style={{
              color: dark ? "#f9f7f2" : "#0f1f22",
              background: dark ? "#1c4044" : "#ffffff",
              borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(28,64,68,0.12)",
            }}
          >
            <option value="latest">최신순</option>
            <option value="popular">인기순</option>
            <option value="discussed">댓글순</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function PostCard({
  p,
  refreshing,
  identity,
  onOpen,
}: {
  p: Post;
  refreshing: boolean;
  identity: string | null;
  onOpen: () => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 220, damping: 22 });
  const sy = useSpring(my, { stiffness: 220, damping: 22 });
  const rY = useTransform(sx, [-0.5, 0.5], [-6, 6]);
  const rX = useTransform(sy, [-0.5, 0.5], [5, -5]);

  const router = useRouter();
  const [likes, setLikes] = useState(p.likes);
  const [liked, setLiked] = useState(p.likedByMe);
  const [liking, setLiking] = useState(false);
  const [bookmarked, setBookmarked] = useState(p.bookmarkedByMe);
  const [bookmarking, setBookmarking] = useState(false);
  const [commentCount, setCommentCount] = useState(p.comments);
  // 인증 재조회로 새 p가 오면 서버 상태를 반영한다. identity 변경 직후에는 사용자별 상태를 즉시 중립화한다.
  // 카드를 리마운트하지 않아 작성 중인 댓글 입력은 보존한다.
  const [synced, setSynced] = useState({ post: p, identity });
  if (synced.post !== p || synced.identity !== identity) {
    const identityChanged = synced.identity !== identity;
    setSynced({ post: p, identity });
    setLikes(p.likes);
    setCommentCount(p.comments);
    setLiked(identityChanged ? false : p.likedByMe);
    setBookmarked(identityChanged ? false : p.bookmarkedByMe);
  }
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);

  const requireLogin = () => {
    alert("로그인이 필요합니다.");
    router.push("/login");
  };

  const onLike = async () => {
    if (!getToken()) return requireLogin();
    if (liking || refreshing) return; // 연타 방지 + 재조회 중 차단
    setLiking(true);
    const requestToken = getToken(); // 요청 identity 캡처
    try {
      const updated = liked
        ? await apiDelete<Post>(`/api/posts/${p.id}/like`)
        : await apiPost<Post>(`/api/posts/${p.id}/like`, {});
      if (getToken() !== requestToken) return; // 응답 전 로그아웃/토큰교체 → 무시
      setLikes(updated.likes);
      setLiked(updated.likedByMe);
    } catch (e) {
      if (getToken() !== requestToken) return; // 이미 로그아웃한 사용자 재이동 방지
      if (e instanceof ApiError && e.status === 401) requireLogin();
      else alert("좋아요 처리에 실패했습니다.");
    } finally {
      setLiking(false);
    }
  };

  const onBookmark = async () => {
    const requestToken = getToken();
    if (!requestToken) return requireLogin();
    if (bookmarking || refreshing) return;
    setBookmarking(true);
    try {
      const updated = bookmarked
        ? await apiDelete<Post>(`/api/posts/${p.id}/bookmark`)
        : await apiPost<Post>(`/api/posts/${p.id}/bookmark`, {});
      if (getToken() !== requestToken) return;
      setBookmarked(updated.bookmarkedByMe);
    } catch (e) {
      if (getToken() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) requireLogin();
      else alert("북마크 처리에 실패했습니다.");
    } finally {
      setBookmarking(false);
    }
  };

  const toggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && !commentsLoaded) {
      try {
        setComments(await apiGet<PostComment[]>(`/api/posts/${p.id}/comments`));
        setCommentsError("");
      } catch {
        setComments([]);
        setCommentsError("댓글을 불러오지 못했습니다.");
      } finally {
        setCommentsLoaded(true);
      }
    }
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text || busy) return;
    if (text.length > MAX_COMMENT_LENGTH) return alert(`댓글은 ${MAX_COMMENT_LENGTH}자 이하여야 합니다.`);
    if (!getToken()) return requireLogin();
    setBusy(true);
    try {
      const created = await apiPost<PostComment>(`/api/posts/${p.id}/comments`, { text });
      setComments((cs) => [...cs, created]);
      setCommentCount((c) => c + 1);
      setCommentText("");
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.status === 401) requireLogin();
      else alert("댓글 작성에 실패했습니다.");
      return;
    }
    setBusy(false);
  };

  return (
    <div style={{ perspective: 1200 }}>
      <motion.article
        ref={ref}
        onMouseMove={(e) => {
          const r = ref.current?.getBoundingClientRect();
          if (!r) return;
          mx.set((e.clientX - r.left) / r.width - 0.5);
          my.set((e.clientY - r.top) / r.height - 0.5);
        }}
        onMouseLeave={() => {
          mx.set(0);
          my.set(0);
        }}
        style={{
          rotateX: rX,
          rotateY: rY,
          transformStyle: "preserve-3d",
          background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
          borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
        }}
        className="rounded-2xl border overflow-hidden shadow-[0_20px_50px_-25px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center gap-3 p-4">
          <Avatar name={p.author.name} verified={p.author.verified} />
          <div className="flex-1">
            <div style={{ color: dark ? "#f9f7f2" : "#0f1f22", fontSize: 14 }}>{p.author.name}</div>
            <div className="text-[11px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{p.time}</div>
          </div>
        </div>

        {p.images.length === 1 ? (
          <button type="button" className="block aspect-[4/3] w-full overflow-hidden" onClick={onOpen} aria-label="게시글 상세 보기">
            <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
          </button>
        ) : (
          <button type="button" className="grid aspect-[4/3] w-full grid-cols-2 gap-0.5 overflow-hidden" onClick={onOpen} aria-label="게시글 상세 보기">
            {p.images.map((src, i) => (
              <img key={i} src={src} alt="" className="w-full h-full object-cover" />
            ))}
          </button>
        )}

        <div className="p-4 space-y-3">
          <p style={{ color: dark ? "#f9f7f2" : "#0f1f22", fontSize: 14, lineHeight: 1.6 }}>{p.text}</p>
          <div className="flex flex-wrap gap-1.5">
            {p.tags.map((t) => (
              <span key={t} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: dark ? "rgba(125,211,163,0.12)" : "rgba(125,211,163,0.2)", color: dark ? "#7dd3a3" : "#1c4044" }}>
                {t}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}>
            <div className="flex flex-wrap gap-3 text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}>
              <button onClick={onLike} disabled={liking || refreshing} className="flex items-center gap-1 hover:text-[#ed5c48] transition-colors disabled:opacity-50" style={liked ? { color: "#ed5c48" } : undefined}>
                <Heart size={14} fill={liked ? "#ed5c48" : "none"} /> {likes}
              </button>
              <button onClick={toggleComments} className="flex items-center gap-1">
                <MessageCircle size={14} /> {commentCount}
              </button>
              <button className="flex items-center gap-1">
                <Share2 size={14} />
              </button>
              <ReportButton targetType="POST" targetId={p.id} ownedByMe={p.ownedByMe} className="!px-2 !py-1" />
            </div>
            <button
              onClick={onBookmark}
              disabled={bookmarking || refreshing}
              aria-label={bookmarked ? "북마크 해제" : "북마크 추가"}
              className="transition-colors disabled:opacity-50"
              style={{ color: bookmarked ? "#7dd3a3" : dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}
            >
              <Bookmark size={14} fill={bookmarked ? "#7dd3a3" : "transparent"} />
            </button>
          </div>

          {showComments && (
            <div className="pt-3 border-t space-y-3" style={{ borderColor: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}>
              {commentsError ? (
                <p className="text-[12px]" style={{ color: "#ed5c48" }}>{commentsError}</p>
              ) : comments.length === 0 ? (
                <p className="text-[12px] opacity-50" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
                  {commentsLoaded ? "첫 댓글을 남겨보세요." : "댓글을 불러오는 중…"}
                </p>
              ) : (
                comments.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex gap-2 items-start">
                    <Avatar name={c.author.name} verified={c.author.verified} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
                        {c.author.name} <span className="opacity-50">· {c.time}</span>
                      </div>
                      <p className="text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.8)" : "rgba(28,64,68,0.8)" }}>{c.text}</p>
                    </div>
                  </div>
                ))
              )}
              <div className="flex items-center gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submitComment())}
                  placeholder="댓글 달기…"
                  maxLength={MAX_COMMENT_LENGTH}
                  className="flex-1 bg-transparent outline-none text-[13px] px-3 py-2 rounded-full"
                  style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.04)", color: dark ? "#f9f7f2" : "#0f1f22" }}
                />
                <button onClick={submitComment} disabled={busy || !commentText.trim()} className="p-2 rounded-full disabled:opacity-40" style={{ background: "#7dd3a3", color: "#0f1f22" }}>
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.article>
    </div>
  );
}

function SideHot({ campaigns }: { campaigns: Campaign[] }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={14} style={{ color: "#7dd3a3" }} />
        <h3 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 18, color: dark ? "#f9f7f2" : "#0f1f22" }}>
          진행 중인 캠페인
        </h3>
      </div>
      <div className="space-y-3">
        {campaigns.map((c) => {
          const pct = progressPercent(c.joined, c.capacity);
          return (
            <div key={c.id} className="flex gap-3 items-center">
              <img src={c.thumb} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] truncate" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
                  {c.title}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 rounded-full" style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.08)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: statusMeta[c.status].color }} />
                  </div>
                  <span className="text-[11px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{pct}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SideRecommend() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const users = ["초록도시", "원두모음", "리메이크목공방", "보틀앤캔들"];
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={14} style={{ color: "#7dd3a3" }} />
        <h3 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 18, color: dark ? "#f9f7f2" : "#0f1f22" }}>
          이런 분 어때요
        </h3>
      </div>
      <div className="space-y-3">
        {users.map((n) => (
          <div key={n} className="flex items-center gap-3">
            <Avatar name={n} />
            <div className="flex-1 text-[13px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              {n}
            </div>
            <button className="text-[12px] px-3 py-1 rounded-full" style={{ background: "#7dd3a3", color: "#0f1f22" }}>
              팔로우
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FeedClient({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const { token } = useAuthSession();
  const dark = theme === "dark";
  const [retryTick, setRetryTick] = useState(0);
  const generationRef = useRef(0);

  const urlState = useMemo<UrlState>(() => {
    const sort = searchParams.get("sort");
    return {
      query: searchParams.get("q") ?? "",
      campaignOnly: searchParams.get("campaignOnly") === "true",
      sort: sort === "popular" || sort === "discussed" ? sort : "latest",
      page: parsePage(searchParams.get("page")),
    };
  }, [searchParams]);
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
    const params = new URLSearchParams();
    if (next.query) params.set("q", next.query);
    if (next.campaignOnly) params.set("campaignOnly", "true");
    params.set("sort", next.sort);
    params.set("page", next.page.toString());
    const href = `/feed?${params.toString()}`;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [router, urlState]);

  const commitSearch = useCallback((query: string) => {
    updateUrl({ query, page: 0 }, true);
  }, [updateUrl]);

  const searchPath = useMemo(() => {
    const params = new URLSearchParams();
    if (urlState.query) params.set("q", urlState.query);
    params.set("campaignOnly", urlState.campaignOnly.toString());
    params.set("sort", urlState.sort);
    params.set("page", urlState.page.toString());
    params.set("size", "10");
    return `/api/posts/search?${params.toString()}`;
  }, [urlState.campaignOnly, urlState.page, urlState.query, urlState.sort]);

  useEffect(() => {
    const requestToken = token;
    if (getToken() !== requestToken) return;

    const generation = ++generationRef.current;
    let cancelled = false;
    const isCurrent = () =>
      !cancelled && generation === generationRef.current && getToken() === requestToken;

    apiGet<PostSearchResponse>(searchPath)
      .then((nextResponse) => {
        if (!isCurrent()) return;
        setSearchState({
          identity: requestIdentity,
          queryIdentity,
          token: requestToken,
          status: "success",
          response: nextResponse,
        });
      })
      .catch((error) => {
        if (!isCurrent()) return;
        if (error instanceof ApiError && error.status === 401 && requestToken) {
          clearSession();
          return;
        }
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

    return () => {
      cancelled = true;
    };
  }, [queryIdentity, requestIdentity, searchPath, token]);

  return (
    <section
      className="relative min-h-screen pt-28 pb-20 px-6 transition-colors overflow-hidden"
      style={{
        position: "relative",
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-20 left-1/3 w-[500px] h-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <div className="relative mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main>
          <button
            onClick={() => router.push("/posts/new")}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border mb-6 hover:-translate-y-0.5 transition-transform text-left"
            style={{
              background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
              borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
            }}
          >
            <Avatar name="나" />
            <span className="flex-1 opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              지금 어떤 업사이클을 하고 있나요?
            </span>
            <span className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-full" style={{ background: "#7dd3a3", color: "#0f1f22" }}>
              <ImageIcon size={14} /> 새 글
            </span>
          </button>

          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>
              {response ? `검색 결과 ${response.totalElements.toLocaleString()}개` : "게시글 검색"}
            </p>
            <button
              type="button"
              aria-label="피드 새로고침"
              onClick={() => setRetryTick((tick) => tick + 1)}
              disabled={refreshing}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-45"
              style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.06)" }}
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>

          <FeedControls
            state={urlState}
            onSearch={commitSearch}
            onSort={(sort) => updateUrl({ sort, page: 0 })}
            onCampaignOnly={(campaignOnly) => updateUrl({ campaignOnly, page: 0 })}
          />

          {requestStatus === "loading" && !response ? (
            <StatePanel>
              <RefreshCw size={28} className="animate-spin text-[#7dd3a3]" />
              <p style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>게시글을 검색하는 중입니다.</p>
            </StatePanel>
          ) : null}

          {requestStatus === "error" && !response ? (
            <StatePanel>
              <p style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>게시글을 불러오지 못했습니다.</p>
              <button
                type="button"
                onClick={() => setRetryTick((tick) => tick + 1)}
                className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]"
              >
                다시 시도
              </button>
            </StatePanel>
          ) : null}

          {requestStatus === "error" && response ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ed5c48]/25 px-4 py-3 text-[12px] text-[#ed5c48]">
              <span>최신 게시글을 불러오지 못해 이전 결과를 표시합니다.</span>
              <button type="button" onClick={() => setRetryTick((tick) => tick + 1)} className="underline underline-offset-4">
                다시 시도
              </button>
            </div>
          ) : null}

          {requestStatus === "success" && response?.content.length === 0 ? (
            <StatePanel>
              <p style={{ color: dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}>조건에 맞는 게시글이 없습니다.</p>
            </StatePanel>
          ) : null}

          {response && response.content.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {response.content.map((post, i) => (
                <StaggerItem key={post.id} index={i}>
                  <PostCard
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
            <SideHot campaigns={campaigns} />
            <SideRecommend />
          </div>
        </aside>
      </div>
    </section>
  );
}

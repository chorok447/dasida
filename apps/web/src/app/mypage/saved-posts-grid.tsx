"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, Heart, LogIn, MessageCircle, RefreshCw } from "lucide-react";
import { apiDelete, apiGet, ApiError } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { useTheme } from "@/lib/theme-context";
import type { Post } from "@/data/posts";

type LoadStatus = "idle" | "loading" | "success" | "error";

type SavedPostsState = {
  identity: string | null;
  status: LoadStatus;
  posts: Post[];
  error: string;
  actionError: string;
};

function operationKey(token: string, postId: string) {
  return `${token}:${postId}`;
}

function StatePanel({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div
      className="min-h-64 rounded-2xl border flex flex-col items-center justify-center gap-4 px-6 text-center"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
        color: dark ? "#f9f7f2" : "#0f1f22",
      }}
    >
      {children}
    </div>
  );
}

function SavedPostCard({
  post,
  removing,
  onRemove,
}: {
  post: Post;
  removing: boolean;
  onRemove: (postId: string) => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const image = post.images[0];

  return (
    <article
      className="relative overflow-hidden rounded-2xl border shadow-[0_20px_45px_-25px_rgba(0,0,0,0.45)] transition-transform hover:-translate-y-1"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <Link href={`/posts/${post.id}`} className="block h-full">
        {image ? (
          <div className="aspect-[4/3] overflow-hidden">
            <img src={image} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div
            className="aspect-[4/3] flex items-center p-6"
            style={{
              background: dark
                ? "linear-gradient(135deg,rgba(125,211,163,0.16),rgba(255,255,255,0.03))"
                : "linear-gradient(135deg,rgba(125,211,163,0.3),rgba(231,223,203,0.5))",
              color: dark ? "#f9f7f2" : "#0f1f22",
            }}
          >
            <p className="line-clamp-4 text-[15px] leading-7">{post.text}</p>
          </div>
        )}

        <div className="space-y-3 p-4" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-[13px] font-medium">{post.author.name}</span>
            <span className="shrink-0 text-[11px] opacity-55">{post.time}</span>
          </div>
          {image ? <p className="line-clamp-2 text-[13px] leading-6 opacity-80">{post.text}</p> : null}
          <div className="flex items-center gap-4 text-[12px] opacity-65">
            <span className="flex items-center gap-1"><Heart size={13} /> {post.likes}</span>
            <span className="flex items-center gap-1"><MessageCircle size={13} /> {post.comments}</span>
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => onRemove(post.id)}
        disabled={removing}
        aria-label={`${post.author.name} 게시글 북마크 해제`}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 disabled:cursor-wait disabled:opacity-50"
        style={{ background: "#7dd3a3", color: "#0f1f22" }}
      >
        <Bookmark size={16} fill="#0f1f22" />
      </button>
    </article>
  );
}

export function SavedPostsGrid() {
  const { token } = useAuthSession();
  const [reloadTick, setReloadTick] = useState(0);
  const [state, setState] = useState<SavedPostsState>(() => ({
    identity: token,
    status: token ? "loading" : "idle",
    posts: [],
    error: "",
    actionError: "",
  }));
  const requestGenerationRef = useRef(0);
  const removingKeysRef = useRef(new Set<string>());
  const [removingKeys, setRemovingKeys] = useState<Set<string>>(() => new Set());

  // 로그인/로그아웃/token 교체 시 이전 사용자의 목록과 오류를 렌더 단계에서 즉시 제거한다.
  if (state.identity !== token) {
    setState({
      identity: token,
      status: token ? "loading" : "idle",
      posts: [],
      error: "",
      actionError: "",
    });
  }

  useEffect(() => {
    if (!token) return;

    const requestToken = token;
    const generation = ++requestGenerationRef.current;
    let cancelled = false;
    const isCurrent = () =>
      !cancelled && generation === requestGenerationRef.current && getToken() === requestToken;

    apiGet<Post[]>("/api/posts/bookmarks")
      .then((posts) => {
        if (!isCurrent()) return;
        setState((current) =>
          current.identity === requestToken
            ? { ...current, status: "success", posts, error: "" }
            : current,
        );
      })
      .catch((error) => {
        if (!isCurrent()) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          return;
        }
        setState((current) =>
          current.identity === requestToken
            ? {
                ...current,
                status: "error",
                posts: [],
                error: "저장한 게시글을 불러오지 못했습니다.",
              }
            : current,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [reloadTick, token]);

  const retry = () => {
    setState((current) => ({ ...current, status: "loading", error: "", actionError: "" }));
    setReloadTick((tick) => tick + 1);
  };

  const removeBookmark = async (postId: string) => {
    const requestToken = getToken();
    if (!requestToken) {
      clearSession();
      return;
    }

    const key = operationKey(requestToken, postId);
    if (removingKeysRef.current.has(key)) return;
    removingKeysRef.current.add(key);
    setRemovingKeys((current) => new Set(current).add(key));
    setState((current) => ({ ...current, actionError: "" }));

    try {
      await apiDelete<Post>(`/api/posts/${postId}/bookmark`);
      if (getToken() !== requestToken || !removingKeysRef.current.has(key)) return;
      setState((current) =>
        current.identity === requestToken
          ? { ...current, posts: current.posts.filter((post) => post.id !== postId) }
          : current,
      );
    } catch (error) {
      if (getToken() !== requestToken || !removingKeysRef.current.has(key)) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
      } else {
        setState((current) =>
          current.identity === requestToken
            ? { ...current, actionError: "북마크 해제에 실패했습니다." }
            : current,
        );
      }
    } finally {
      removingKeysRef.current.delete(key);
      setRemovingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  if (!token) {
    return (
      <StatePanel>
        <LogIn size={28} className="text-[#7dd3a3]" />
        <p>저장한 게시글을 보려면 로그인이 필요합니다.</p>
        <Link href="/login" className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
          로그인 페이지로 이동
        </Link>
      </StatePanel>
    );
  }

  if (state.status === "loading") {
    return (
      <StatePanel>
        <RefreshCw size={26} className="animate-spin text-[#7dd3a3]" />
        <p>저장한 게시글을 불러오는 중입니다.</p>
      </StatePanel>
    );
  }

  if (state.status === "error") {
    return (
      <StatePanel>
        <p>{state.error}</p>
        <button type="button" onClick={retry} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
          다시 시도
        </button>
      </StatePanel>
    );
  }

  if (state.posts.length === 0) {
    return (
      <StatePanel>
        <Bookmark size={28} className="text-[#7dd3a3]" />
        <p>저장한 게시글이 없습니다.</p>
      </StatePanel>
    );
  }

  return (
    <div className="space-y-4">
      {state.actionError ? (
        <p role="alert" className="rounded-xl bg-[#ed5c48]/10 px-4 py-3 text-[13px] text-[#ed5c48]">
          {state.actionError}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {state.posts.map((post) => (
          <SavedPostCard
            key={post.id}
            post={post}
            removing={removingKeys.has(operationKey(token, post.id))}
            onRemove={removeBookmark}
          />
        ))}
      </div>
    </div>
  );
}

"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Heart, MessageCircle, PenLine, RefreshCw } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { useTheme } from "@/lib/theme-context";
import type { Post } from "@/data/posts";

type LoadStatus = "idle" | "loading" | "success" | "error";

type MyPostsState = {
  identity: string | null;
  status: LoadStatus;
  posts: Post[];
  error: string;
};

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

function MyPostCard({ post }: { post: Post }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const image = post.images[0];

  return (
    <Link
      href={`/posts/${post.id}`}
      className="block overflow-hidden rounded-2xl border shadow-[0_20px_45px_-25px_rgba(0,0,0,0.45)] transition-transform hover:-translate-y-1"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      {image ? (
        <div className="aspect-[4/3] overflow-hidden">
          <img src={image} alt={`${post.author.name}님의 게시글`} className="h-full w-full object-cover" />
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
          <p className="line-clamp-4 text-[15px] leading-7 break-words">{post.text}</p>
        </div>
      )}

      <div className="space-y-3 p-4" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-[13px] font-medium">{post.author.name}</span>
          <span className="shrink-0 text-[11px] opacity-55">{post.time}</span>
        </div>
        {image ? <p className="line-clamp-2 text-[13px] leading-6 opacity-80 break-words">{post.text}</p> : null}
        {post.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="max-w-full truncate rounded-full px-2 py-0.5 text-[11px]"
                style={{
                  background: dark ? "rgba(125,211,163,0.14)" : "rgba(125,211,163,0.22)",
                  color: dark ? "#7dd3a3" : "#1c4044",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-4 text-[12px] opacity-65">
          <span className="flex items-center gap-1">
            <Heart size={13} fill={post.likedByMe ? "currentColor" : "none"} /> {post.likes}
          </span>
          <span className="flex items-center gap-1"><MessageCircle size={13} /> {post.comments}</span>
        </div>
      </div>
    </Link>
  );
}

export function MyPostsGrid() {
  const { token } = useAuthSession();
  const [reloadTick, setReloadTick] = useState(0);
  const [state, setState] = useState<MyPostsState>(() => ({
    identity: token,
    status: token ? "loading" : "idle",
    posts: [],
    error: "",
  }));
  const generationRef = useRef(0);

  // token 교체 시 이전 사용자 목록을 네트워크 응답보다 먼저 제거
  if (state.identity !== token) {
    setState({
      identity: token,
      status: token ? "loading" : "idle",
      posts: [],
      error: "",
    });
  }

  useEffect(() => {
    if (!token) return;

    const requestToken = token;
    const generation = ++generationRef.current;
    let cancelled = false;
    const isCurrent = () =>
      !cancelled && generation === generationRef.current && getToken() === requestToken;

    apiGet<Post[]>("/api/posts/mine")
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
                error: "내 게시글을 불러오지 못했습니다.",
              }
            : current,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [reloadTick, token]);

  const retry = () => {
    setState((current) => ({ ...current, status: "loading", error: "" }));
    setReloadTick((tick) => tick + 1);
  };

  if (state.status === "loading") {
    return (
      <StatePanel>
        <RefreshCw size={26} className="animate-spin text-[#7dd3a3]" />
        <p>내 게시글을 불러오는 중입니다.</p>
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
        <FileText size={28} className="text-[#7dd3a3]" />
        <p>작성한 게시글이 없습니다.</p>
        <Link
          href="/posts/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]"
        >
          <PenLine size={14} /> 첫 게시글 작성하기
        </Link>
      </StatePanel>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {state.posts.map((post) => (
        <MyPostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

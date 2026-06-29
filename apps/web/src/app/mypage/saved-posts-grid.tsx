"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import { Bookmark, Heart, MessageCircle } from "lucide-react";
import { apiDelete, ApiError } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { useTheme } from "@/lib/theme-context";
import { fetchBookmarkedPostsPage, type Post } from "@/data/posts";
import { PaginatedSection } from "./paginated-section";

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

export function SavedPostsGrid({ page, onPageChange }: { page: number; onPageChange: (page: number) => void }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  // 저장 해제 성공 시 현재 page 를 재조회한다(마지막 항목이면 PaginatedSection 이 이전 page 로 이동).
  const removeBookmark = async (postId: string, reload: () => void) => {
    if (removingId) return;
    const requestToken = getToken();
    if (!requestToken) {
      clearSession();
      return;
    }
    setRemovingId(postId);
    setActionError("");
    try {
      await apiDelete<Post>(`/api/posts/${postId}/bookmark`);
      if (getToken() !== requestToken) return;
      reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        return;
      }
      setActionError("북마크 해제에 실패했습니다.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <PaginatedSection<Post>
      identityKey="saved"
      page={page}
      onPageChange={onPageChange}
      fetcher={fetchBookmarkedPostsPage}
      loadingLabel="저장한 게시글을 불러오는 중입니다."
      errorLabel="저장한 게시글을 불러오지 못했습니다."
      empty={
        <StatePanel>
          <Bookmark size={28} className="text-[#7dd3a3]" />
          <p>저장한 게시글이 없습니다.</p>
          <Link href="/feed" className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
            피드 둘러보기
          </Link>
        </StatePanel>
      }
      renderItems={(posts, reload) => (
        <div className="space-y-4">
          {actionError ? (
            <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: "rgba(237,92,72,0.12)", color: dark ? "#f3b4ab" : "#b3402f" }}>
              {actionError}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <SavedPostCard
                key={post.id}
                post={post}
                removing={removingId === post.id}
                onRemove={(id) => removeBookmark(id, reload)}
              />
            ))}
          </div>
        </div>
      )}
    />
  );
}

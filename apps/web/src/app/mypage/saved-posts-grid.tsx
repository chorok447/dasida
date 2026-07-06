"use client";

import { StaggerItem } from "@/components/scroll-reveal";
import { FallbackImage } from "@/components/fallback-image";
import { ListEmptyState } from "@/components/list-empty-state";
import { PostPreview } from "@/components/post-text";
import { useState } from "react";
import Link from "next/link";
import { Bookmark, ExternalLink, Heart, MessageCircle } from "lucide-react";
import { apiDelete, ApiError } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
import { useTheme } from "@/lib/theme-context";
import { fetchBookmarkedPostsPage, type Post } from "@/data/posts";
import { PaginatedSection } from "./paginated-section";

function cardActionClass(dark: boolean) {
  return `inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] transition-colors ${
    dark
      ? "border border-white/12 bg-white/5 text-white/85 hover:bg-white/10"
      : "border border-[rgba(28,64,68,0.12)] bg-white text-[#1c4044] hover:bg-[rgba(28,64,68,0.04)]"
  }`;
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
      className="overflow-hidden rounded-2xl border shadow-[0_20px_45px_-25px_rgba(0,0,0,0.45)]"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <Link href={`/posts/${post.id}`} className="block transition-transform hover:-translate-y-0.5">
        {image ? (
          <div className="aspect-[4/3] overflow-hidden">
            <FallbackImage src={image} alt="게시글 미리보기 이미지" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div
            className="flex aspect-[4/3] items-center p-6"
            style={{
              background: dark
                ? "linear-gradient(135deg,rgba(125,211,163,0.16),rgba(255,255,255,0.03))"
                : "linear-gradient(135deg,rgba(125,211,163,0.3),rgba(231,223,203,0.5))",
              color: dark ? "#f9f7f2" : "#0f1f22",
            }}
          >
            <PostPreview text={post.text} className="line-clamp-4 text-[15px] leading-7" maxLength={280} />
          </div>
        )}

        <div className="space-y-3 p-4" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-[13px] font-medium">{post.author.name}</span>
            <span className="shrink-0 text-[11px] opacity-55">{post.time}</span>
          </div>
          {image ? <PostPreview text={post.text} className="line-clamp-2 text-[13px] leading-6 opacity-80" maxLength={120} /> : null}
          <div className="flex items-center gap-4 text-[12px] opacity-65">
            <span className="flex items-center gap-1">
              <Heart size={13} /> {post.likes}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={13} /> {post.comments}
            </span>
          </div>
        </div>
      </Link>

      <div className="flex flex-wrap gap-2 border-t px-4 py-3" style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}>
        <Link href={`/posts/${post.id}`} className={cardActionClass(dark)}>
          <ExternalLink size={12} aria-hidden /> 상세 보기
        </Link>
        <button
          type="button"
          onClick={() => onRemove(post.id)}
          disabled={removing}
          aria-busy={removing || undefined}
          aria-label={removing ? "북마크 해제 중" : "북마크 해제"}
          className={`${cardActionClass(dark)} disabled:cursor-wait disabled:opacity-50`}
        >
          <Bookmark size={12} fill="currentColor" aria-hidden /> 저장 해제
        </button>
      </div>
    </article>
  );
}

export function SavedPostsGrid({ page, onPageChange }: { page: number; onPageChange: (page: number) => void }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const removeBookmark = async (postId: string, reload: () => void) => {
    if (removingId) return;
    const requestToken = getSessionId();
    if (!requestToken) {
      clearSession();
      return;
    }
    setRemovingId(postId);
    setActionError("");
    try {
      await apiDelete<Post>(`/api/posts/${postId}/bookmark`);
      if (getSessionId() !== requestToken) return;
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
        <ListEmptyState
          title="저장한 글이 없어요."
          action={
            <Link
              href="/feed"
              className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] font-medium text-[#0f1f22]"
            >
              피드 둘러보기
            </Link>
          }
        />
      }
      renderItems={(posts, reload) => (
        <div className="space-y-4">
          {actionError ? (
            <div
              className="rounded-xl px-4 py-3 text-[13px]"
              role="alert"
              style={{ background: "rgba(237,92,72,0.12)", color: dark ? "#f3b4ab" : "#b3402f" }}
            >
              {actionError}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
              <StaggerItem key={post.id} index={i}>
                <SavedPostCard
                  post={post}
                  removing={removingId === post.id}
                  onRemove={(id) => removeBookmark(id, reload)}
                />
              </StaggerItem>
            ))}
          </div>
        </div>
      )}
    />
  );
}

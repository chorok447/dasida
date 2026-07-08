"use client";

import { StaggerItem } from "@/components/scroll-reveal";
import { FallbackImage } from "@/components/fallback-image";
import { ListEmptyState } from "@/components/list-empty-state";
import { PostPreview } from "@/components/post-text";
import Link from "next/link";
import { ExternalLink, EyeOff, Heart, MessageCircle, PenLine } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { fetchMyPostsPage, type Post } from "@/data/posts";
import { PaginatedSection } from "./paginated-section";

function cardActionClass(dark: boolean) {
  return `inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] transition-colors ${
    dark
      ? "border border-white/12 bg-white/5 text-white/85 hover:bg-white/10"
      : "border border-[rgba(28,64,68,0.12)] bg-white text-[#1c4044] hover:bg-[rgba(28,64,68,0.04)]"
  }`;
}

function MyPostCard({ post }: { post: Post }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const image = post.images[0];

  return (
    <article
      className="overflow-hidden rounded-2xl border shadow-[0_20px_45px_-25px_rgba(0,0,0,0.45)]"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
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
              color: "var(--foreground)",
            }}
          >
            <PostPreview text={post.text} className="line-clamp-4 text-[15px] leading-7" maxLength={280} />
          </div>
        )}

        <div className="space-y-3 p-4" style={{ color: "var(--foreground)" }}>
          {post.hidden ? (
            <p
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
              style={{ background: "rgba(237,92,72,0.14)", color: "#ed5c48" }}
            >
              <EyeOff size={12} aria-hidden /> 운영 정책에 따라 숨김 처리된 게시글입니다
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-[13px] font-medium">{post.author.name}</span>
            <span className="shrink-0 text-[11px] opacity-55">{post.time}</span>
          </div>
          {image ? <PostPreview text={post.text} className="line-clamp-2 text-[13px] leading-6 opacity-80" maxLength={120} /> : null}
          {post.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="max-w-full truncate rounded-full px-2 py-0.5 text-[11px]"
                  style={{
                    background: dark ? "rgba(125,211,163,0.14)" : "rgba(125,211,163,0.22)",
                    color: "var(--accent-secondary)",
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
            <span className="flex items-center gap-1">
              <MessageCircle size={13} /> {post.comments}
            </span>
          </div>
        </div>
      </Link>

      <div className="flex flex-wrap gap-2 border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <Link href={`/posts/${post.id}`} className={cardActionClass(dark)}>
          <ExternalLink size={12} aria-hidden /> 상세 보기
        </Link>
        {post.ownedByMe ? (
          <Link href={`/posts/${post.id}/edit`} className={cardActionClass(dark)}>
            <PenLine size={12} aria-hidden /> 편집
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function MyPostsGrid({ page, onPageChange }: { page: number; onPageChange: (page: number) => void }) {
  return (
    <PaginatedSection<Post>
      identityKey="posts"
      page={page}
      onPageChange={onPageChange}
      fetcher={fetchMyPostsPage}
      loadingLabel="내 게시글을 불러오는 중입니다."
      errorLabel="내 게시글을 불러오지 못했습니다."
      empty={
        <ListEmptyState
          title="아직 작성한 글이 없어요."
          action={
            <Link
              href="/posts/new"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] font-medium text-[#0f1f22]"
            >
              <PenLine size={14} aria-hidden /> 글 작성하기
            </Link>
          }
        />
      }
      renderItems={(posts) => (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <StaggerItem key={post.id} index={i}>
              <MyPostCard post={post} />
            </StaggerItem>
          ))}
        </div>
      )}
    />
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { FallbackImage } from "@/components/fallback-image";
import { ListEmptyState } from "@/components/list-empty-state";
import { PostPreview } from "@/components/post-text";
import { useTheme } from "@/lib/theme-context";
import type { Post } from "@/data/posts";
import { fetchUserPostsPage } from "@/data/users";
import { PaginatedSection } from "@/app/mypage/paginated-section";

function UserPostCard({ post }: { post: Post }) {
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
        <div className="space-y-2 p-4">
          {image ? <PostPreview text={post.text} className="line-clamp-2 text-[14px]" maxLength={120} /> : null}
          <div className="flex items-center gap-3 text-[12px]" style={{ color: "var(--foreground-muted)" }}>
            <span className="inline-flex items-center gap-1">
              <Heart size={12} /> {post.likes}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle size={12} /> {post.comments}
            </span>
            <span className="ml-auto opacity-70">{post.time}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function UserPostsGrid({ userId }: { userId: number }) {
  const [page, setPage] = useState(0);

  return (
    <PaginatedSection
      identityKey={`user-posts:${userId}`}
      page={page}
      onPageChange={setPage}
      fetcher={(p) => fetchUserPostsPage(userId, p)}
      loadingLabel="게시글을 불러오는 중입니다."
      errorLabel="게시글을 불러오지 못했습니다."
      renderItems={(posts) => (
        <div className="grid gap-5 sm:grid-cols-2">
          {posts.map((post) => (
            <UserPostCard key={post.id} post={post} />
          ))}
        </div>
      )}
      empty={<ListEmptyState title="아직 게시글이 없어요" description="첫 업사이클 이야기를 기다리고 있어요." />}
    />
  );
}

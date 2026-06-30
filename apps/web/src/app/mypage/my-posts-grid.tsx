"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FileText, Heart, MessageCircle, PenLine } from "lucide-react";
import { StatePanel } from "@/components/ui/state-panel";
import { useTheme } from "@/lib/theme-context";
import { fetchMyPostsPage, type Post } from "@/data/posts";
import { PaginatedSection } from "./paginated-section";

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
        <StatePanel className="min-h-64 rounded-2xl">
          <FileText size={28} className="text-[#7dd3a3]" />
          <p>작성한 게시글이 없습니다.</p>
          <Link
            href="/posts/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]"
          >
            <PenLine size={14} /> 첫 게시글 작성하기
          </Link>
        </StatePanel>
      }
      renderItems={(posts) => (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <MyPostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    />
  );
}

"use client";

import Link from "next/link";
import { Bookmark, Heart, MessageCircle, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { FallbackImage } from "@/components/fallback-image";
import { PostPreview } from "@/components/post-text";
import { ReportButton } from "@/components/report-button";
import { campaignRecruitMeta, type Campaign } from "@/data/campaigns";
import type { Post } from "@/data/posts";
import { progressPercent } from "@/lib/progress";

export function CampaignResultCard({ campaign }: { campaign: Campaign }) {
  const progress = progressPercent(campaign.joined, campaign.capacity);
  const meta = campaignRecruitMeta(campaign);

  return (
    <div className="relative">
      <ReportButton
        targetType="CAMPAIGN"
        targetId={campaign.id}
        ownedByMe={campaign.ownedByMe}
        className="absolute left-3 top-3 z-20 !px-2.5 !py-1.5"
      />
      <Link
        href={`/campaigns/${campaign.id}`}
        className="group block overflow-hidden rounded-2xl border transition-transform hover:-translate-y-1"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
        }}
      >
        <div className="relative aspect-[16/9] overflow-hidden">
          {campaign.thumb ? (
            <FallbackImage
              src={campaign.thumb}
              alt={`${campaign.title} 캠페인 이미지`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#1c4044] to-[#148a90] text-[12px] text-white/70">
              캠페인 이미지 없음
            </div>
          )}
          <span
            className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] tracking-[0.15em]"
            style={{ background: meta.color, color: meta.fg }}
          >
            {meta.label}
          </span>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <h3 className="line-clamp-1 text-[17px] font-semibold" style={{ color: "var(--foreground)" }}>
              {campaign.title}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-6 opacity-65" style={{ color: "var(--foreground)" }}>
              {campaign.summary}
            </p>
          </div>
          <div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: meta.color }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] opacity-60" style={{ color: "var(--foreground)" }}>
              <span className="flex items-center gap-1.5">
                <Users size={12} /> {campaign.joined} / {campaign.capacity}명
              </span>
              <span>{campaign.daysLeftLabel}</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

export function PostResultCard({ post }: { post: Post }) {
  const image = post.images[0];

  return (
    <Link
      href={`/posts/${post.id}`}
      className="group overflow-hidden rounded-2xl border transition-transform hover:-translate-y-1"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center gap-3 p-4">
        <Avatar name={post.author.name} verified={post.author.verified} src={post.author.profileImageUrl ?? undefined} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
            {post.author.name}
          </p>
          <p className="text-[11px] opacity-50" style={{ color: "var(--foreground)" }}>{post.time}</p>
        </div>
        {post.bookmarkedByMe ? <Bookmark size={15} fill="#7dd3a3" className="shrink-0 text-[#7dd3a3]" /> : null}
      </div>
      {image ? (
        <div className="aspect-[16/9] overflow-hidden">
          <FallbackImage
            src={image}
            alt="게시글 미리보기 이미지"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-[#1c4044] to-[#2d666c] px-6 text-center text-[13px] leading-6 text-white/75">
          {post.text.slice(0, 90)}
        </div>
      )}
      <div className="space-y-3 p-4">
        <PostPreview
          text={post.text}
          className="line-clamp-3 text-[14px] leading-6"
          style={{ color: "var(--foreground)" }}
          maxLength={200}
        />
        <div className="flex flex-wrap gap-1.5">
          {post.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-[#7dd3a3]/15 px-2 py-0.5 text-[10px] text-[#148a90]">{tag}</span>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t pt-3 text-[12px] opacity-65" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
          <span className="flex items-center gap-1" style={post.likedByMe ? { color: "#ed5c48" } : undefined}>
            <Heart size={13} fill={post.likedByMe ? "#ed5c48" : "none"} /> {post.likes}
          </span>
          <span className="flex items-center gap-1"><MessageCircle size={13} /> {post.comments}</span>
        </div>
      </div>
    </Link>
  );
}

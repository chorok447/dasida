"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import {
  Heart,
  MessageCircle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import { AuthorHeader } from "@/components/author-header";
import { FallbackImage } from "@/components/fallback-image";
import { PostText } from "@/components/post-text";
import { RichBodyImageGrid } from "@/components/rich-body-image-grid";
import { ShareButton } from "@/components/share-button";
import type { Post } from "@/data/posts";
import type { Campaign } from "@/data/campaigns";

export function PostDetailHero({
  post: p,
  linkedCampaign,
  idx,
  imageFailed,
  likes,
  liked,
  liking,
  bookmarked,
  bookmarking,
  refreshing,
  commentCount,
  onImageError,
  onPrevImage,
  onNextImage,
  onLike,
  onBookmark,
  onOpenCampaign,
  onScrollToComments,
}: {
  post: Post;
  linkedCampaign: Campaign | null;
  idx: number;
  imageFailed: boolean;
  likes: number;
  liked: boolean;
  liking: boolean;
  bookmarked: boolean;
  bookmarking: boolean;
  refreshing: boolean;
  commentCount: number;
  onImageError: () => void;
  onPrevImage: () => void;
  onNextImage: () => void;
  onLike: () => void;
  onBookmark: () => void;
  onOpenCampaign: (id: string) => void;
  onScrollToComments: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 150, damping: 22 });
  const sy = useSpring(my, { stiffness: 150, damping: 22 });
  const rY = useTransform(sx, [-0.5, 0.5], [-5, 5]);
  const rX = useTransform(sy, [-0.5, 0.5], [4, -4]);

  return (
    <div style={{ perspective: 1400 }}>
      <motion.div
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
          background: "var(--card)",
          borderColor: "var(--border)",
        }}
        className="rounded-3xl border overflow-hidden shadow-[0_40px_80px_-30px_rgba(0,0,0,0.4)] grid grid-cols-1 md:grid-cols-[1.2fr_1fr]"
      >
        <div className="relative aspect-square md:aspect-auto bg-black overflow-hidden">
          {imageFailed ? (
            <div className="flex h-full w-full items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
              <ImageIcon size={32} color="rgba(255,255,255,0.35)" aria-hidden />
            </div>
          ) : (
            <motion.img
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={p.images[idx]}
              alt={`게시글 이미지 ${idx + 1}`}
              className="w-full h-full object-cover"
              onError={onImageError}
            />
          )}
          {p.images.length > 1 && (
            <>
              <button
                type="button"
                onClick={onPrevImage}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "rgba(15,31,34,0.6)", color: "#fff" }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={onNextImage}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "rgba(15,31,34,0.6)", color: "#fff" }}
              >
                <ChevronRight size={18} />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {p.images.map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === idx ? "#7dd3a3" : "rgba(255,255,255,0.4)" }} />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-7 flex flex-col gap-5">
          <AuthorHeader
            name={p.author.name}
            verified={p.author.verified}
            profileImageUrl={p.author.profileImageUrl}
            authorId={p.authorId}
            avatarSize={40}
            time={p.time}
          />

          <PostText text={p.text} style={{ color: "var(--foreground)", lineHeight: 1.7 }} />

          <RichBodyImageGrid images={p.images} altPrefix="게시글 이미지" />

          <div className="flex flex-wrap gap-1.5">
            {p.tags.map((t) => (
              <span key={t} className="text-[12px] px-2.5 py-0.5 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent-secondary)" }}>
                {t}
              </span>
            ))}
          </div>

          {linkedCampaign && (
            <div
              className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer"
              onClick={() => onOpenCampaign(linkedCampaign.id)}
              style={{
                background: "var(--accent-soft)",
                border: "1px solid rgba(125,211,163,0.25)",
              }}
            >
              <FallbackImage
                src={linkedCampaign.thumb}
                alt={`${linkedCampaign.title} 캠페인 이미지`}
                className="w-10 h-10 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] opacity-70" style={{ color: "var(--foreground)" }}>연결된 캠페인</div>
                <div className="text-[13px] truncate" style={{ color: "var(--foreground)" }}>{linkedCampaign.title}</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={onLike}
              disabled={liking || refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] disabled:opacity-50"
              style={{
                background: liked ? "rgba(237,92,72,0.15)" : "var(--border)",
                color: liked ? "#ed5c48" : "var(--foreground)",
              }}
            >
              <Heart size={14} fill={liked ? "#ed5c48" : "transparent"} /> {likes}
            </motion.button>
            <button
              type="button"
              onClick={onScrollToComments}
              aria-label="댓글 보기"
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px]"
              style={{ background: "var(--border)", color: "var(--foreground)" }}
            >
              <MessageCircle size={14} /> {commentCount}
            </button>
            <ShareButton
              title={p.text.slice(0, 80)}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px]"
              style={{ background: "var(--border)", color: "var(--foreground)" }}
            />
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={onBookmark}
              disabled={bookmarking || refreshing}
              aria-label={bookmarked ? "북마크 해제" : "북마크 추가"}
              className="ml-auto w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-50"
              style={{
                background: bookmarked ? "#7dd3a3" : "var(--border)",
                color: bookmarked ? "#0f1f22" : "var(--foreground)",
              }}
            >
              <Bookmark size={14} fill={bookmarked ? "#0f1f22" : "transparent"} />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

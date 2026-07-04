"use client";

import { toast } from "sonner";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowLeft, Heart, MessageCircle, Bookmark, ChevronLeft, ChevronRight, Pencil, Trash2, Image as ImageIcon } from "lucide-react";
import { apiPost, apiDelete, apiDeleteVoid, ApiError } from "@/lib/api";
import { getSessionId, clearSession } from "@/lib/auth";
import { useAuthedRefresh } from "@/lib/use-authed-refresh";
import { Avatar } from "@/components/avatar";
import { FallbackImage } from "@/components/fallback-image";
import { ReportButton } from "@/components/report-button";
import { ShareButton } from "@/components/share-button";
import { PageShell } from "@/components/page-shell";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { Post } from "@/data/posts";
import type { Campaign } from "@/data/campaigns";
import { PostDetailComments } from "./post-detail-comments";

export default function PostDetailClient({ post, linkedCampaign }: { post: Post; linkedCampaign: Campaign | null }) {
  const router = useRouter();
  const p = post;
  const [idx, setIdx] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [likes, setLikes] = useState(p.likes);
  const [liked, setLiked] = useState(p.likedByMe);
  const [liking, setLiking] = useState(false);
  const [bookmarked, setBookmarked] = useState(p.bookmarkedByMe);
  const [bookmarking, setBookmarking] = useState(false);
  const [owned, setOwned] = useState(p.ownedByMe);
  const [deleting, setDeleting] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments);
  const commentSectionRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();

  const { refreshing, invalidatePending } = useAuthedRefresh<Post>(
    `/api/posts/${p.id}`,
    (u) => {
      setLikes(u.likes);
      setLiked(u.likedByMe);
      setBookmarked(u.bookmarkedByMe);
      setOwned(u.ownedByMe);
    },
    () => {
      setLiked(false);
      setBookmarked(false);
      setOwned(false);
    },
  );

  const onDelete = async () => {
    if (deleting) return;
    const requestToken = getSessionId();
    if (!requestToken) {
      toast.error("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    if (!(await confirm({ message: "이 게시글을 삭제할까요? 되돌릴 수 없습니다.", destructive: true, confirmLabel: "삭제" }))) return;
    setDeleting(true);
    try {
      await apiDeleteVoid(`/api/posts/${p.id}`);
      if (getSessionId() !== requestToken) return;
      router.push("/mypage");
    } catch (e) {
      if (getSessionId() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        toast.error("로그인이 필요합니다.");
        router.push("/login");
      } else if (e instanceof ApiError && e.status === 403) {
        toast.error("삭제 권한이 없습니다.");
      } else {
        toast.error("게시글 삭제에 실패했습니다.");
      }
    } finally {
      setDeleting(false);
    }
  };

  const onLike = async () => {
    if (!getSessionId()) {
      toast.error("로그인 후 이용할 수 있어요.");
      router.push("/login");
      return;
    }
    if (liking || refreshing) return;
    setLiking(true);
    invalidatePending();
    const requestToken = getSessionId();
    try {
      const updated = liked
        ? await apiDelete<Post>(`/api/posts/${p.id}/like`)
        : await apiPost<Post>(`/api/posts/${p.id}/like`, {});
      if (getSessionId() !== requestToken) return;
      setLikes(updated.likes);
      setLiked(updated.likedByMe);
    } catch (e) {
      if (getSessionId() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        toast.error("로그인 후 이용할 수 있어요.");
        router.push("/login");
      } else {
        toast.error("좋아요 처리에 실패했습니다.");
      }
    } finally {
      setLiking(false);
    }
  };

  const onBookmark = async () => {
    const requestToken = getSessionId();
    if (!requestToken) {
      toast.error("로그인 후 이용할 수 있어요.");
      router.push("/login");
      return;
    }
    if (bookmarking || refreshing) return;
    setBookmarking(true);
    invalidatePending();
    try {
      const updated = bookmarked
        ? await apiDelete<Post>(`/api/posts/${p.id}/bookmark`)
        : await apiPost<Post>(`/api/posts/${p.id}/bookmark`, {});
      if (getSessionId() !== requestToken) return;
      setBookmarked(updated.bookmarkedByMe);
    } catch (e) {
      if (getSessionId() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        toast.error("로그인 후 이용할 수 있어요.");
        router.push("/login");
      } else {
        toast.error("북마크 처리에 실패했습니다.");
      }
    } finally {
      setBookmarking(false);
    }
  };

  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 150, damping: 22 });
  const sy = useSpring(my, { stiffness: 150, damping: 22 });
  const rY = useTransform(sx, [-0.5, 0.5], [-5, 5]);
  const rX = useTransform(sy, [-0.5, 0.5], [4, -4]);

  return (
    <PageShell paddingClassName="relative min-h-screen pt-28 pb-20 px-6 overflow-hidden" orb="right">
      <div className="max-w-5xl mx-auto relative">
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            onClick={() => router.push("/feed")}
            className="inline-flex items-center gap-2 text-[13px] opacity-70 hover:opacity-100"
            style={{ color: "var(--foreground)" }}
          >
            <ArrowLeft size={14} /> 피드로 돌아가기
          </button>

          {owned ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/posts/${p.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px]"
                style={{ background: "var(--border)", color: "var(--foreground)" }}
              >
                <Pencil size={13} /> 수정
              </Link>
              <button
                onClick={onDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] disabled:opacity-50"
                style={{ background: "rgba(237,92,72,0.15)", color: "#ed5c48" }}
              >
                <Trash2 size={13} /> {deleting ? "삭제 중…" : "삭제"}
              </button>
            </div>
          ) : (
            <ReportButton targetType="POST" targetId={p.id} ownedByMe={false} />
          )}
        </div>

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
                  onError={() => setImageFailed(true)}
                />
              )}
              {p.images.length > 1 && (
                <>
                  <button
                    onClick={() => {
                      setImageFailed(false);
                      setIdx((i) => (i - 1 + p.images.length) % p.images.length);
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(15,31,34,0.6)", color: "#fff" }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => {
                      setImageFailed(false);
                      setIdx((i) => (i + 1) % p.images.length);
                    }}
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
              <div className="flex items-center gap-3">
                <Avatar name={p.author.name} verified={p.author.verified} size={40} />
                <div>
                  <div style={{ color: "var(--foreground)" }}>{p.author.name}</div>
                  <div className="text-[12px] opacity-60" style={{ color: "var(--foreground)" }}>{p.time}</div>
                </div>
              </div>

              <p style={{ color: "var(--foreground)", lineHeight: 1.7 }}>
                {p.text}
              </p>

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
                  onClick={() => router.push(`/campaigns/${linkedCampaign.id}`)}
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
                  onClick={() => commentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
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

        <PostDetailComments
          postId={p.id}
          count={commentCount}
          onCountChange={setCommentCount}
          sectionRef={commentSectionRef}
        />
      </div>
    </PageShell>
  );
}

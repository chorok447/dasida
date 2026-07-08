"use client";

import { toast } from "sonner";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import { apiGet, apiPost, apiDelete, ApiError } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { Avatar } from "@/components/avatar";
import { AuthorHeader } from "@/components/author-header";
import { FallbackImage } from "@/components/fallback-image";
import { PostPreview } from "@/components/post-text";
import { ReportButton } from "@/components/report-button";
import { ShareButton } from "@/components/share-button";
import { TagLink } from "@/components/tag-link";
import type { Post, PostComment } from "@/data/posts";

const MAX_COMMENT_LENGTH = 500;

export function FeedPostCard({
  p,
  refreshing,
  identity,
  onOpen,
}: {
  p: Post;
  refreshing: boolean;
  identity: string | null;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 220, damping: 22 });
  const sy = useSpring(my, { stiffness: 220, damping: 22 });
  const rY = useTransform(sx, [-0.5, 0.5], [-6, 6]);
  const rX = useTransform(sy, [-0.5, 0.5], [5, -5]);

  const router = useRouter();
  const { sessionId: token } = useAuthSession();
  const [likes, setLikes] = useState(p.likes);
  const [liked, setLiked] = useState(p.likedByMe);
  const [liking, setLiking] = useState(false);
  const [bookmarked, setBookmarked] = useState(p.bookmarkedByMe);
  const [bookmarking, setBookmarking] = useState(false);
  const [commentCount, setCommentCount] = useState(p.comments);
  const [synced, setSynced] = useState({ post: p, identity });
  if (synced.post !== p || synced.identity !== identity) {
    const identityChanged = synced.identity !== identity;
    setSynced({ post: p, identity });
    setLikes(p.likes);
    setCommentCount(p.comments);
    setLiked(identityChanged ? false : p.likedByMe);
    setBookmarked(identityChanged ? false : p.bookmarkedByMe);
  }
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);

  const promptLogin = (message: string, expired = false) => {
    if (expired) clearSession();
    toast.error(message);
    router.push("/login");
  };

  const onLike = async () => {
    if (!getSessionId()) return promptLogin("로그인 후 이용할 수 있어요.");
    if (liking || refreshing) return;
    setLiking(true);
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
      if (e instanceof ApiError && e.status === 401) promptLogin("로그인 후 이용할 수 있어요.", true);
      else toast.error("좋아요 처리에 실패했습니다.");
    } finally {
      setLiking(false);
    }
  };

  const onBookmark = async () => {
    const requestToken = getSessionId();
    if (!requestToken) return promptLogin("로그인 후 이용할 수 있어요.");
    if (bookmarking || refreshing) return;
    setBookmarking(true);
    try {
      const updated = bookmarked
        ? await apiDelete<Post>(`/api/posts/${p.id}/bookmark`)
        : await apiPost<Post>(`/api/posts/${p.id}/bookmark`, {});
      if (getSessionId() !== requestToken) return;
      setBookmarked(updated.bookmarkedByMe);
    } catch (e) {
      if (getSessionId() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) promptLogin("로그인 후 이용할 수 있어요.", true);
      else toast.error("북마크 처리에 실패했습니다.");
    } finally {
      setBookmarking(false);
    }
  };

  const toggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && !commentsLoaded) {
      try {
        setComments(await apiGet<PostComment[]>(`/api/posts/${p.id}/comments`));
        setCommentsError("");
      } catch {
        setComments([]);
        setCommentsError("댓글을 불러오지 못했습니다.");
      } finally {
        setCommentsLoaded(true);
      }
    }
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text || busy) return;
    if (text.length > MAX_COMMENT_LENGTH) return toast.error(`댓글은 ${MAX_COMMENT_LENGTH}자 이하여야 합니다.`);
    if (!getSessionId()) return promptLogin("로그인해야 댓글을 작성할 수 있어요.");
    setBusy(true);
    try {
      const created = await apiPost<PostComment>(`/api/posts/${p.id}/comments`, { text });
      setComments((cs) => [...cs, created]);
      setCommentCount((c) => c + 1);
      setCommentText("");
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.status === 401) promptLogin("로그인해야 댓글을 작성할 수 있어요.", true);
      else toast.error("댓글 작성에 실패했습니다.");
      return;
    }
    setBusy(false);
  };

  return (
    <div style={{ perspective: 1200 }}>
      <motion.article
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
        className="rounded-2xl border overflow-hidden shadow-[0_20px_50px_-25px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center gap-3 p-4">
          <AuthorHeader
            className="flex-1"
            name={p.author.name}
            verified={p.author.verified}
            profileImageUrl={p.author.profileImageUrl}
            authorId={p.authorId}
            time={p.time}
            timeClassName="text-[11px] opacity-60"
          />
        </div>

        {p.images.length === 1 ? (
          <button type="button" className="block aspect-[4/3] w-full overflow-hidden" onClick={onOpen} aria-label="게시글 상세 보기">
            <FallbackImage src={p.images[0]} alt="" decorative thumbnail className="w-full h-full object-cover" />
          </button>
        ) : (
          <button type="button" className="grid aspect-[4/3] w-full grid-cols-2 gap-0.5 overflow-hidden" onClick={onOpen} aria-label="게시글 상세 보기">
            {p.images.map((src, i) => (
              <FallbackImage key={i} src={src} alt="" decorative thumbnail className="w-full h-full object-cover" />
            ))}
          </button>
        )}

        <div className="p-4 space-y-3">
          <PostPreview text={p.text} style={{ color: "var(--foreground)", fontSize: 14, lineHeight: 1.6 }} maxLength={320} />
          <div className="flex flex-wrap gap-1.5">
            {p.tags.map((t) => (
              <TagLink key={t} tag={t} className="text-[11px] px-2 py-0.5 rounded-full transition-opacity hover:opacity-75" style={{ background: "var(--accent-soft)", color: "var(--accent-secondary)" }} />
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="flex flex-wrap gap-3 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
              <motion.button whileTap={{ scale: 0.85 }} onClick={onLike} disabled={liking || refreshing} className="flex items-center gap-1 hover:text-[#ed5c48] transition-colors disabled:opacity-50" style={liked ? { color: "#ed5c48" } : undefined}>
                <Heart size={14} fill={liked ? "#ed5c48" : "none"} /> {likes}
              </motion.button>
              <button onClick={toggleComments} className="flex items-center gap-1">
                <MessageCircle size={14} /> {commentCount}
              </button>
              <ShareButton
                title={p.text.slice(0, 80)}
                className="flex items-center gap-1 hover:text-[#ed5c48] transition-colors"
              />
              <ReportButton targetType="POST" targetId={p.id} ownedByMe={p.ownedByMe} className="!px-2 !py-1" />
            </div>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={onBookmark}
              disabled={bookmarking || refreshing}
              aria-label={bookmarked ? "북마크 해제" : "북마크 추가"}
              className="transition-colors disabled:opacity-50"
              style={{ color: bookmarked ? "#7dd3a3" : "var(--foreground-muted)" }}
            >
              <Bookmark size={14} fill={bookmarked ? "#7dd3a3" : "transparent"} />
            </motion.button>
          </div>

          {showComments && (
            <div className="pt-3 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
              {commentsError ? (
                <p className="text-[12px]" style={{ color: "#ed5c48" }}>{commentsError}</p>
              ) : comments.length === 0 ? (
                <p className="text-[12px] opacity-50" style={{ color: "var(--foreground)" }}>
                  {commentsLoaded ? "첫 댓글을 남겨보세요." : "댓글을 불러오는 중…"}
                </p>
              ) : (
                comments.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex gap-2 items-start">
                    <Avatar
                      name={c.author.name}
                      verified={c.author.verified}
                      size={32}
                      src={c.author.profileImageUrl ?? undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px]" style={{ color: "var(--foreground)" }}>
                        {c.author.name} <span className="opacity-50">· {c.time}</span>
                      </div>
                      <p className="text-[13px]" style={{ color: "var(--border)" }}>{c.text}</p>
                    </div>
                  </div>
                ))
              )}
              {token ? (
                <div className="flex items-center gap-2">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submitComment())}
                    placeholder="댓글 달기…"
                    aria-label="댓글 내용"
                    maxLength={MAX_COMMENT_LENGTH}
                    className="flex-1 bg-transparent outline-none text-[13px] px-3 py-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3a3]"
                    style={{ background: "var(--border)", color: "var(--foreground)" }}
                  />
                  <button
                    onClick={submitComment}
                    disabled={busy || !commentText.trim()}
                    aria-label="댓글 등록"
                    className="p-2 rounded-full disabled:opacity-40"
                    style={{ background: "#7dd3a3", color: "#0f1f22" }}
                  >
                    <Send size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-center" style={{ background: "var(--border)" }}>
                  <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
                    로그인해야 댓글을 작성할 수 있어요.
                  </p>
                  <button type="button" onClick={() => router.push("/login")} className="rounded-full bg-[#7dd3a3] px-4 py-1.5 text-[12px] text-[#0f1f22]">
                    로그인하기
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.article>
    </div>
  );
}

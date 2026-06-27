"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowLeft, Heart, MessageCircle, Share2, Bookmark, Send, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { apiGet, apiPost, apiDelete, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useAuthedRefresh } from "@/lib/use-authed-refresh";
import { Avatar } from "@/components/avatar";
import type { Post, PostComment } from "@/data/posts";
import type { Campaign } from "@/data/campaigns";

const MAX_COMMENT_LENGTH = 500;

export default function PostDetailClient({ post, linkedCampaign }: { post: Post; linkedCampaign: Campaign | null }) {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const p = post;
  const [idx, setIdx] = useState(0);
  const [likes, setLikes] = useState(p.likes);
  const [liked, setLiked] = useState(p.likedByMe);
  const [liking, setLiking] = useState(false);
  const [bookmarked, setBookmarked] = useState(p.bookmarkedByMe);
  const [bookmarking, setBookmarking] = useState(false);

  // 새로고침·로그인/로그아웃 시 좋아요·북마크 상태와 likes를 동기화한다.
  // identity 변경 시 사용자별 상태만 즉시 neutral(false), likes 숫자는 유지한다.
  const { refreshing, invalidatePending } = useAuthedRefresh<Post>(
    `/api/posts/${p.id}`,
    (u) => {
      setLikes(u.likes);
      setLiked(u.likedByMe);
      setBookmarked(u.bookmarkedByMe);
    },
    () => {
      setLiked(false);
      setBookmarked(false);
    },
  );

  // ---- 댓글 ----
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState("");
  const [commentCount, setCommentCount] = useState(post.comments);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const commentSectionRef = useRef<HTMLDivElement>(null);

  // 진입 시(및 재시도/post 변경 시) 댓글 목록 조회. cancelled 플래그로 늦은 응답·언마운트 보호.
  // loading/error 초기화는 effect 동기 setState 대신 초기 상태값과 retry 핸들러에서 처리(lint).
  useEffect(() => {
    let cancelled = false;
    apiGet<PostComment[]>(`/api/posts/${p.id}/comments`)
      .then((list) => {
        if (cancelled) return;
        setComments(list);
        setCommentCount(list.length); // 실제 목록 길이와 동기화
        setCommentsError("");
      })
      .catch(() => {
        if (!cancelled) setCommentsError("댓글을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [p.id, reloadTick]);

  const retryComments = () => {
    setCommentsLoading(true);
    setCommentsError("");
    setReloadTick((t) => t + 1);
  };

  const submitComment = async () => {
    const text = commentText.trim();
    // 목록 조회/에러 중에는 작성 금지 → 늦게 도착한 GET 이 방금 추가한 댓글을 덮는 경합 방지.
    if (!text || submittingComment || commentsLoading || commentsError) return;
    if (text.length > MAX_COMMENT_LENGTH) {
      alert(`댓글은 ${MAX_COMMENT_LENGTH}자 이하여야 합니다.`);
      return;
    }
    if (!getToken()) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    setSubmittingComment(true);
    const requestToken = getToken(); // 요청 identity 캡처
    try {
      const created = await apiPost<PostComment>(`/api/posts/${p.id}/comments`, { text });
      if (getToken() !== requestToken) return; // 요청 중 로그아웃/토큰교체 → 무시
      setComments((cs) => [...cs, created]);
      setCommentCount((c) => c + 1);
      setCommentText("");
    } catch (e) {
      if (getToken() !== requestToken) return; // 이미 로그아웃한 사용자 재이동 방지
      if (e instanceof ApiError && e.status === 401) {
        alert("로그인이 필요합니다.");
        router.push("/login");
      } else {
        alert("댓글 작성에 실패했습니다.");
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const onLike = async () => {
    if (!getToken()) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    if (liking || refreshing) return; // 연타 방지 + 재조회 중 차단
    setLiking(true);
    invalidatePending(); // 늦게 도착할 재조회가 좋아요 결과를 덮어쓰지 않게
    const requestToken = getToken(); // 요청 identity 캡처
    try {
      const updated = liked
        ? await apiDelete<Post>(`/api/posts/${p.id}/like`)
        : await apiPost<Post>(`/api/posts/${p.id}/like`, {});
      if (getToken() !== requestToken) return; // 응답 전 로그아웃/토큰교체 → 무시
      setLikes(updated.likes);
      setLiked(updated.likedByMe);
    } catch (e) {
      if (getToken() !== requestToken) return; // 이미 로그아웃한 사용자 재이동 방지
      if (e instanceof ApiError && e.status === 401) {
        alert("로그인이 필요합니다.");
        router.push("/login");
      } else {
        alert("좋아요 처리에 실패했습니다.");
      }
    } finally {
      setLiking(false);
    }
  };

  const onBookmark = async () => {
    const requestToken = getToken();
    if (!requestToken) {
      alert("로그인이 필요합니다.");
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
      if (getToken() !== requestToken) return;
      setBookmarked(updated.bookmarkedByMe);
    } catch (e) {
      if (getToken() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) {
        alert("로그인이 필요합니다.");
        router.push("/login");
      } else {
        alert("북마크 처리에 실패했습니다.");
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
    <section
      className="relative min-h-screen pt-28 pb-20 px-6 transition-colors overflow-hidden"
      style={{
        position: "relative",
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-40 right-1/4 w-[500px] h-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <div className="max-w-5xl mx-auto relative">
        <button
          onClick={() => router.push("/feed")}
          className="mb-6 inline-flex items-center gap-2 text-[13px] opacity-70 hover:opacity-100"
          style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
        >
          <ArrowLeft size={14} /> 피드로 돌아가기
        </button>

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
              background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
              borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
            }}
            className="rounded-3xl border overflow-hidden shadow-[0_40px_80px_-30px_rgba(0,0,0,0.4)] grid grid-cols-1 md:grid-cols-[1.2fr_1fr]"
          >
            <div className="relative aspect-square md:aspect-auto bg-black overflow-hidden">
              <motion.img
                key={idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                src={p.images[idx]}
                alt=""
                className="w-full h-full object-cover"
              />
              {p.images.length > 1 && (
                <>
                  <button
                    onClick={() => setIdx((i) => (i - 1 + p.images.length) % p.images.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(15,31,34,0.6)", color: "#fff" }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setIdx((i) => (i + 1) % p.images.length)}
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
                  <div style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{p.author.name}</div>
                  <div className="text-[12px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{p.time}</div>
                </div>
              </div>

              <p style={{ color: dark ? "rgba(255,255,255,0.9)" : "rgba(28,64,68,0.9)", lineHeight: 1.7 }}>
                {p.text}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <span key={t} className="text-[12px] px-2.5 py-0.5 rounded-full" style={{ background: dark ? "rgba(125,211,163,0.12)" : "rgba(125,211,163,0.2)", color: dark ? "#7dd3a3" : "#1c4044" }}>
                    {t}
                  </span>
                ))}
              </div>

              {linkedCampaign && (
                <div
                  className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer"
                  onClick={() => router.push(`/campaigns/${linkedCampaign.id}`)}
                  style={{
                    background: dark ? "rgba(125,211,163,0.08)" : "rgba(125,211,163,0.15)",
                    border: `1px solid ${dark ? "rgba(125,211,163,0.2)" : "rgba(125,211,163,0.3)"}`,
                  }}
                >
                  <img src={linkedCampaign.thumb} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>연결된 캠페인</div>
                    <div className="text-[13px] truncate" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{linkedCampaign.title}</div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={onLike}
                  disabled={liking || refreshing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] disabled:opacity-50"
                  style={{
                    background: liked ? "rgba(237,92,72,0.15)" : dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)",
                    color: liked ? "#ed5c48" : dark ? "#f9f7f2" : "#0f1f22",
                  }}
                >
                  <Heart size={14} fill={liked ? "#ed5c48" : "transparent"} /> {likes}
                </motion.button>
                <button
                  onClick={() => commentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  aria-label="댓글 보기"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px]"
                  style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)", color: dark ? "#f9f7f2" : "#0f1f22" }}
                >
                  <MessageCircle size={14} /> {commentCount}
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px]" style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)", color: dark ? "#f9f7f2" : "#0f1f22" }}>
                  <Share2 size={14} />
                </button>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={onBookmark}
                  disabled={bookmarking || refreshing}
                  aria-label={bookmarked ? "북마크 해제" : "북마크 추가"}
                  className="ml-auto w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-50"
                  style={{
                    background: bookmarked ? "#7dd3a3" : dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)",
                    color: bookmarked ? "#0f1f22" : dark ? "#f9f7f2" : "#0f1f22",
                  }}
                >
                  <Bookmark size={14} fill={bookmarked ? "#0f1f22" : "transparent"} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>

        <div
          ref={commentSectionRef}
          className="mt-8 rounded-3xl border p-8 scroll-mt-24"
          style={{
            background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
            borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
          }}
        >
          <h3 className="mb-6" style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 22, color: dark ? "#f9f7f2" : "#0f1f22" }}>
            댓글 {commentCount}
          </h3>
          <div
            className="flex items-center gap-3 p-3 rounded-2xl mb-6"
            style={{ background: dark ? "rgba(255,255,255,0.04)" : "rgba(28,64,68,0.04)" }}
          >
            <Avatar name="나" />
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                // 한글 IME 조합 중 Enter 는 제출하지 않음.
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submitComment();
                }
              }}
              placeholder="댓글 달기..."
              maxLength={MAX_COMMENT_LENGTH}
              disabled={submittingComment || commentsLoading || !!commentsError}
              className="flex-1 bg-transparent outline-none placeholder:opacity-50 disabled:opacity-50"
              style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
            />
            <button
              onClick={submitComment}
              disabled={submittingComment || commentsLoading || !!commentsError || !commentText.trim()}
              aria-label="댓글 등록"
              className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40"
              style={{ background: "#7dd3a3", color: "#0f1f22" }}
            >
              <Send size={14} />
            </button>
          </div>
          <div className="space-y-5 min-h-[64px]">
            {commentsLoading ? (
              <p className="text-[13px] opacity-50" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>댓글을 불러오는 중…</p>
            ) : commentsError ? (
              <div className="flex items-center gap-3">
                <p className="text-[13px]" style={{ color: "#ed5c48" }}>{commentsError}</p>
                <button
                  onClick={retryComments}
                  className="text-[12px] px-3 py-1 rounded-full"
                  style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)", color: dark ? "#f9f7f2" : "#0f1f22" }}
                >
                  다시 시도
                </button>
              </div>
            ) : comments.length === 0 ? (
              <p className="text-[13px] opacity-50" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>첫 댓글을 남겨보세요.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <Avatar name={c.author.name} verified={c.author.verified} />
                  <div>
                    <div className="flex items-center gap-2 text-[13px]">
                      <span style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{c.author.name}</span>
                      <span className="opacity-50" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>· {c.time}</span>
                    </div>
                    <p className="mt-0.5" style={{ color: dark ? "rgba(255,255,255,0.85)" : "rgba(28,64,68,0.85)" }}>
                      {c.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

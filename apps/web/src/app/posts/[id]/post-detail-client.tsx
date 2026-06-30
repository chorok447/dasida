"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowLeft, Heart, MessageCircle, Share2, Bookmark, Send, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { apiPost, apiDelete, apiDeleteVoid, ApiError, apiErrorMessage } from "@/lib/api";
import { getToken, clearSession } from "@/lib/auth";
import { useAuthedRefresh } from "@/lib/use-authed-refresh";
import { useAuthSession } from "@/lib/use-auth-session";
import { Avatar } from "@/components/avatar";
import { Pagination } from "@/components/ui/pagination";
import {
  fetchPostCommentPageLocation,
  fetchPostCommentsPage,
  updatePostComment,
  type Post,
  type PostComment,
  type PostCommentsPageResponse,
} from "@/data/posts";
import type { Campaign } from "@/data/campaigns";

const MAX_COMMENT_LENGTH = 500;

type CommentsState = {
  identity: string;
  status: "loading" | "success" | "error";
  response: PostCommentsPageResponse | null;
  error: string;
};

type TargetLocationState = {
  identity: string;
  status: "loading" | "success" | "not-found" | "error";
  page: number | null;
  message: string;
};

function parseCommentsPage(value: string | null): number {
  if (value === null) return 0;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export default function PostDetailClient({ post, linkedCampaign }: { post: Post; linkedCampaign: Campaign | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuthSession();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const p = post;
  const [idx, setIdx] = useState(0);
  const [likes, setLikes] = useState(p.likes);
  const [liked, setLiked] = useState(p.likedByMe);
  const [liking, setLiking] = useState(false);
  const [bookmarked, setBookmarked] = useState(p.bookmarkedByMe);
  const [bookmarking, setBookmarking] = useState(false);
  // 작성자 여부. 서버 렌더(public)는 항상 false → 인증된 client refresh 결과를 반영한다.
  const [owned, setOwned] = useState(p.ownedByMe);
  const [deleting, setDeleting] = useState(false);

  // 새로고침·로그인/로그아웃 시 좋아요·북마크·소유 상태와 likes를 동기화한다.
  // identity 변경 시 사용자별 상태만 즉시 neutral(false), likes 숫자는 유지한다.
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
      setOwned(false); // 로그아웃/토큰교체 시 이전 사용자의 작성자 UI가 남지 않게
    },
  );

  const onDelete = async () => {
    if (deleting) return;
    const requestToken = getToken();
    if (!requestToken) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    if (!confirm("이 게시글을 삭제할까요? 되돌릴 수 없습니다.")) return;
    setDeleting(true);
    try {
      await apiDeleteVoid(`/api/posts/${p.id}`);
      if (getToken() !== requestToken) return; // 요청 중 로그아웃/토큰교체 → 이동 취소
      router.push("/mypage");
    } catch (e) {
      if (getToken() !== requestToken) return; // 오래된 응답을 현재 상태에 반영하지 않음
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        alert("로그인이 필요합니다.");
        router.push("/login");
      } else if (e instanceof ApiError && e.status === 403) {
        alert("삭제 권한이 없습니다.");
      } else {
        alert("게시글 삭제에 실패했습니다.");
      }
    } finally {
      // 토큰 변경으로 무시한 경우에도 버튼이 영구 비활성화되지 않게 정리.
      setDeleting(false);
    }
  };

  // ---- 댓글 ----
  const commentsPage = parseCommentsPage(searchParams.get("commentsPage"));
  const rawCommentsPage = searchParams.get("commentsPage");
  const targetCommentId = searchParams.get("commentId")?.trim() || null;
  const [commentCount, setCommentCount] = useState(post.comments);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const commentsRequestGenerationRef = useRef(0);
  const targetRequestGenerationRef = useRef(0);
  const deletingCommentIdsRef = useRef(new Set<string>());
  const [deletingCommentIds, setDeletingCommentIds] = useState<Set<string>>(() => new Set());
  const savingCommentIdRef = useRef<string | null>(null);
  const editRequestGenerationRef = useRef(0);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [editCommentError, setEditCommentError] = useState("");
  const commentSectionRef = useRef<HTMLDivElement>(null);
  const targetIdentity = JSON.stringify([p.id, targetCommentId]);
  const [targetLocationState, setTargetLocationState] = useState<TargetLocationState>({
    identity: "",
    status: "loading",
    page: null,
    message: "",
  });
  const currentTargetLocation: TargetLocationState | null = targetCommentId
    ? targetLocationState.identity === targetIdentity
      ? targetLocationState
      : { identity: targetIdentity, status: "loading", page: null, message: "" }
    : null;
  const targetLocationStatus = currentTargetLocation?.status;
  const targetLocationPage = currentTargetLocation?.page;
  const targetLocationMessage = currentTargetLocation?.message ?? "";
  const targetResolution = currentTargetLocation
    ? `${currentTargetLocation.status}:${currentTargetLocation.page ?? ""}`
    : "none";
  const commentsRequestIdentity = JSON.stringify([
    p.id,
    token,
    commentsPage,
    reloadTick,
    targetCommentId,
    targetResolution,
  ]);
  const [commentsState, setCommentsState] = useState<CommentsState>({
    identity: "",
    status: "loading",
    response: null,
    error: "",
  });
  const currentCommentsState: CommentsState = commentsState.identity === commentsRequestIdentity
    ? commentsState
    : { identity: commentsRequestIdentity, status: "loading", response: null, error: "" };
  const currentCommentsStatus = currentCommentsState.status;
  const currentCommentsResponse = currentCommentsState.response;
  const visibleComments = currentCommentsState.response?.content ?? [];
  const visibleCommentsLoading = currentCommentsState.status === "loading";
  const commentsError = currentCommentsState.status === "error" ? currentCommentsState.error : "";

  const updateCommentsPage = useCallback((page: number, replace = false, preserveTarget = false) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("commentsPage", Math.max(0, page).toString());
    if (!preserveTarget) params.delete("commentId");
    const href = `/posts/${encodeURIComponent(p.id)}?${params.toString()}`;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [p.id, router, searchParams]);

  useEffect(() => {
    if (rawCommentsPage !== null && rawCommentsPage !== commentsPage.toString()) {
      updateCommentsPage(commentsPage, true, !!targetCommentId);
    }
  }, [commentsPage, rawCommentsPage, targetCommentId, updateCommentsPage]);

  // commentId가 있으면 목록보다 먼저 위치를 확인한다. commentsPage가 함께 있어도 location 결과가 우선한다.
  useEffect(() => {
    if (!targetCommentId) return;
    const generation = ++targetRequestGenerationRef.current;
    let cancelled = false;
    const isCurrent = () => !cancelled && generation === targetRequestGenerationRef.current;

    fetchPostCommentPageLocation(p.id, targetCommentId, 20)
      .then((location) => {
        if (!isCurrent()) return;
        setTargetLocationState({
          identity: targetIdentity,
          status: "success",
          page: location.page,
          message: "",
        });
        if (commentsPage !== location.page || rawCommentsPage !== location.page.toString()) {
          updateCommentsPage(location.page, true, true);
        }
      })
      .catch((error) => {
        if (!isCurrent()) return;
        const notFound = error instanceof ApiError && error.status === 404;
        setTargetLocationState({
          identity: targetIdentity,
          status: notFound ? "not-found" : "error",
          page: 0,
          message: notFound ? "댓글을 찾을 수 없습니다." : "댓글 위치를 확인하지 못했습니다.",
        });
        if (commentsPage !== 0 || rawCommentsPage !== "0") {
          updateCommentsPage(0, true, true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [commentsPage, p.id, rawCommentsPage, targetCommentId, targetIdentity, updateCommentsPage]);

  // 댓글 GET은 public이다. 로그인·로그아웃·토큰 교체마다 다시 읽어 ownedByMe를 갱신한다.
  // post/page/generation/token을 함께 확인해 이전 identity의 늦은 응답이 현재 목록을 덮지 못하게 한다.
  useEffect(() => {
    if (targetLocationStatus === "loading") return;
    if (targetLocationPage !== undefined && targetLocationPage !== null && targetLocationPage !== commentsPage) return;
    const requestToken = token;
    const generation = ++commentsRequestGenerationRef.current;
    let cancelled = false;
    const isCurrent = () =>
      !cancelled &&
      generation === commentsRequestGenerationRef.current &&
      getToken() === requestToken;

    fetchPostCommentsPage(p.id, { page: commentsPage, size: 20 }, requestToken)
      .then((response) => {
        if (!isCurrent()) return;
        if (response.content.length === 0 && commentsPage > 0) {
          const previousPage = response.totalPages > 0
            ? Math.min(commentsPage - 1, response.totalPages - 1)
            : 0;
          updateCommentsPage(previousPage, true);
          return;
        }
        setCommentCount(response.totalElements);
        setCommentsState({
          identity: commentsRequestIdentity,
          status: "success",
          response,
          error: "",
        });
      })
      .catch((error) => {
        if (!isCurrent()) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          alert("로그인이 필요합니다.");
          router.push("/login");
          return;
        }
        setCommentsState({
          identity: commentsRequestIdentity,
          status: "error",
          response: null,
          error: error instanceof ApiError && error.status === 404
            ? "게시글을 찾을 수 없습니다."
            : "댓글을 불러오지 못했습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [commentsPage, commentsRequestIdentity, p.id, router, targetLocationPage, targetLocationStatus, token, updateCommentsPage]);

  useEffect(() => {
    if (!targetCommentId || currentCommentsStatus !== "success") return;
    if (!currentCommentsResponse?.content.some((comment) => comment.id === targetCommentId)) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`comment-${targetCommentId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [currentCommentsResponse, currentCommentsStatus, targetCommentId]);

  const retryComments = () => {
    setReloadTick((t) => t + 1);
  };

  const submitComment = async () => {
    const text = commentText.trim();
    // 목록 조회/에러 중에는 작성 금지 → 늦게 도착한 GET 이 방금 추가한 댓글을 덮는 경합 방지.
    if (!text || submittingComment || visibleCommentsLoading || commentsError) return;
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
      await apiPost<PostComment>(`/api/posts/${p.id}/comments`, { text });
      if (getToken() !== requestToken) return; // 요청 중 로그아웃/토큰교체 → 무시
      setCommentCount((c) => c + 1);
      setCommentText("");
      if (commentsPage === 0 && rawCommentsPage === "0") {
        retryComments();
      } else {
        updateCommentsPage(0, commentsPage === 0);
      }
    } catch (e) {
      if (getToken() !== requestToken) return; // 이미 로그아웃한 사용자 재이동 방지
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        alert("로그인이 필요합니다.");
        router.push("/login");
      } else {
        alert("댓글 작성에 실패했습니다.");
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    const requestToken = getToken();
    if (!requestToken) {
      clearSession();
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    if (deletingCommentIdsRef.current.has(commentId)) return;
    if (!confirm("이 댓글을 삭제할까요?")) return;

    deletingCommentIdsRef.current.add(commentId);
    setDeletingCommentIds(new Set(deletingCommentIdsRef.current));
    try {
      await apiDeleteVoid(`/api/posts/${p.id}/comments/${commentId}`);
      if (getToken() !== requestToken) return;
      setCommentCount((current) => Math.max(0, current - 1));
      const response = currentCommentsState.response;
      if (response && response.content.length === 1 && commentsPage > 0) {
        updateCommentsPage(commentsPage - 1);
      } else {
        retryComments();
      }
    } catch (error) {
      if (getToken() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        alert("로그인이 필요합니다.");
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 403) {
        alert("댓글 삭제 권한이 없습니다.");
      } else if (error instanceof ApiError && error.status === 404) {
        alert("이미 삭제되었거나 존재하지 않는 댓글입니다.");
        retryComments();
      } else {
        alert("댓글 삭제에 실패했습니다.");
      }
    } finally {
      deletingCommentIdsRef.current.delete(commentId);
      setDeletingCommentIds(new Set(deletingCommentIdsRef.current));
    }
  };

  const startEditingComment = (comment: PostComment) => {
    if (savingCommentIdRef.current) return;
    setEditingCommentId(comment.id);
    setEditCommentText(comment.text);
    setEditCommentError("");
  };

  const cancelEditingComment = () => {
    if (savingCommentIdRef.current) return;
    editRequestGenerationRef.current += 1;
    setEditingCommentId(null);
    setEditCommentText("");
    setEditCommentError("");
  };

  const saveEditedComment = async (commentId: string) => {
    if (savingCommentIdRef.current) return;
    const text = editCommentText.trim();
    if (!text || text.length > MAX_COMMENT_LENGTH) {
      setEditCommentError(`댓글은 1자 이상 ${MAX_COMMENT_LENGTH}자 이하로 입력해주세요.`);
      return;
    }
    const requestToken = getToken();
    if (!requestToken) {
      clearSession();
      setEditingCommentId(null);
      router.push("/login");
      return;
    }

    const generation = ++editRequestGenerationRef.current;
    savingCommentIdRef.current = commentId;
    setSavingCommentId(commentId);
    setEditCommentError("");
    try {
      const updated = await updatePostComment(p.id, commentId, { text }, requestToken);
      if (getToken() !== requestToken || generation !== editRequestGenerationRef.current) return;
      if (!currentCommentsState.response?.content.some((comment) => comment.id === commentId)) {
        setEditingCommentId(null);
        retryComments();
        return;
      }
      setCommentsState((current) => current.identity === commentsRequestIdentity && current.response
        ? {
            ...current,
            response: {
              ...current.response,
              content: current.response.content.map((comment) => comment.id === commentId ? updated : comment),
            },
          }
        : current);
      setEditingCommentId(null);
      setEditCommentText("");
    } catch (error) {
      if (getToken() !== requestToken || generation !== editRequestGenerationRef.current) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        setEditingCommentId(null);
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 403) {
        alert("댓글을 수정할 권한이 없습니다.");
        setEditingCommentId(null);
        retryComments();
      } else if (error instanceof ApiError && error.status === 404) {
        alert("댓글을 찾을 수 없습니다.");
        setEditingCommentId(null);
        retryComments();
      } else if (error instanceof ApiError && error.status === 400) {
        setEditCommentError(apiErrorMessage(error, "댓글 내용을 확인해주세요."));
      } else {
        setEditCommentError("댓글 수정에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      if (savingCommentIdRef.current === commentId) savingCommentIdRef.current = null;
      setSavingCommentId((current) => current === commentId ? null : current);
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
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            onClick={() => router.push("/feed")}
            className="inline-flex items-center gap-2 text-[13px] opacity-70 hover:opacity-100"
            style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
          >
            <ArrowLeft size={14} /> 피드로 돌아가기
          </button>

          {owned && (
            <div className="flex items-center gap-2">
              <Link
                href={`/posts/${p.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px]"
                style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)", color: dark ? "#f9f7f2" : "#0f1f22" }}
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
          className="mt-8 scroll-mt-24 rounded-3xl border p-5 sm:p-8"
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
              aria-label="댓글 내용"
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
              disabled={submittingComment || visibleCommentsLoading || !!commentsError}
              className="flex-1 bg-transparent outline-none placeholder:opacity-50 disabled:opacity-50"
              style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
            />
            <button
              type="button"
              onClick={submitComment}
              disabled={submittingComment || visibleCommentsLoading || !!commentsError || !commentText.trim()}
              aria-label="댓글 등록"
              className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40"
              style={{ background: "#7dd3a3", color: "#0f1f22" }}
            >
              <Send size={14} />
            </button>
          </div>
          <div className="space-y-5 min-h-[64px]">
            {targetLocationMessage ? (
              <p role="alert" className="text-[13px]" style={{ color: "#ed5c48" }}>
                {targetLocationMessage}
              </p>
            ) : null}
            {visibleCommentsLoading ? (
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
            ) : visibleComments.length === 0 ? (
              <p className="text-[13px] opacity-50" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>첫 댓글을 남겨보세요.</p>
            ) : (
              visibleComments.map((c) => (
                <div
                  key={c.id}
                  id={`comment-${c.id}`}
                  className="flex scroll-mt-28 gap-3 rounded-2xl p-3 transition-colors"
                  style={{
                    background: c.id === targetCommentId
                      ? dark
                        ? "rgba(125,211,163,0.16)"
                        : "rgba(125,211,163,0.24)"
                      : "transparent",
                    outline: c.id === targetCommentId ? "1px solid rgba(125,211,163,0.55)" : "none",
                  }}
                >
                  <Avatar name={c.author.name} verified={c.author.verified} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13px]">
                      <span className="truncate" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{c.author.name}</span>
                      <span className="shrink-0 opacity-50" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
                        · {c.time}{c.edited ? " · 수정됨" : ""}
                      </span>
                      {c.ownedByMe && (
                        <div className="ml-auto flex shrink-0 items-center gap-1.5">
                          {editingCommentId !== c.id ? (
                            <button
                              type="button"
                              onClick={() => startEditingComment(c)}
                              disabled={savingCommentId !== null || deletingCommentIds.has(c.id)}
                              aria-label="댓글 수정"
                              className="flex h-8 w-8 items-center justify-center rounded-full disabled:cursor-wait disabled:opacity-40"
                              style={{ background: "rgba(125,211,163,0.14)", color: dark ? "#7dd3a3" : "#148a90" }}
                            >
                              <Pencil size={14} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => deleteComment(c.id)}
                            disabled={deletingCommentIds.has(c.id) || savingCommentId === c.id}
                            aria-label="댓글 삭제"
                            className="flex h-8 w-8 items-center justify-center rounded-full disabled:cursor-wait disabled:opacity-40"
                            style={{ background: "rgba(237,92,72,0.12)", color: "#ed5c48" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    {c.ownedByMe && editingCommentId === c.id ? (
                      <form
                        className="mt-3 space-y-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveEditedComment(c.id);
                        }}
                      >
                        <textarea
                          aria-label="댓글 수정 내용"
                          autoFocus
                          value={editCommentText}
                          onChange={(event) => setEditCommentText(event.target.value)}
                          maxLength={MAX_COMMENT_LENGTH}
                          rows={3}
                          disabled={savingCommentId === c.id}
                          className="ui-control resize-none bg-transparent px-3 py-2"
                          style={{ borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(28,64,68,0.15)", color: dark ? "#f9f7f2" : "#0f1f22" }}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] opacity-55" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
                            {editCommentText.length} / {MAX_COMMENT_LENGTH}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={cancelEditingComment}
                              disabled={savingCommentId === c.id}
                              className="rounded-full px-3 py-1.5 text-[12px] disabled:opacity-40"
                              style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)", color: dark ? "#f9f7f2" : "#0f1f22" }}
                            >
                              취소
                            </button>
                            <button
                              type="submit"
                              disabled={savingCommentId === c.id || !editCommentText.trim()}
                              className="rounded-full bg-[#7dd3a3] px-3 py-1.5 text-[12px] text-[#0f1f22] disabled:opacity-40"
                            >
                              {savingCommentId === c.id ? "저장 중…" : "저장"}
                            </button>
                          </div>
                        </div>
                        {editCommentError ? <p role="alert" className="text-[12px] text-[#ed5c48]">{editCommentError}</p> : null}
                      </form>
                    ) : (
                      <p className="mt-0.5 whitespace-pre-wrap break-words" style={{ color: dark ? "rgba(255,255,255,0.85)" : "rgba(28,64,68,0.85)" }}>
                        {c.text}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          {currentCommentsState.status === "success" &&
          currentCommentsState.response &&
          currentCommentsState.response.totalElements > 0 ? (
            <Pagination
              page={currentCommentsState.response.page}
              totalPages={currentCommentsState.response.totalPages}
              totalElements={currentCommentsState.response.totalElements}
              compact
              className="mt-7"
              onPageChange={updateCommentsPage}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

"use client";

import { toast } from "sonner";
import { useCallback, useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CornerDownRight, Heart, Pencil, Send, Trash2 } from "lucide-react";
import { ApiError, apiPost, apiDeleteVoid } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
import { usePagedComments } from "@/lib/use-paged-comments";
import { Avatar } from "@/components/avatar";
import { CurrentUserAvatar } from "@/components/current-user-avatar";
import { MentionText } from "@/components/mention-text";
import { ReportButton } from "@/components/report-button";
import { Pagination } from "@/components/ui/pagination";
import {
  fetchPostCommentPageLocation,
  fetchPostCommentsPage,
  likePostComment,
  unlikePostComment,
  updatePostComment,
  type CommentLikeStatus,
  type PostComment,
} from "@/data/posts";

const MAX_COMMENT_LENGTH = 500;

function parseCommentsPage(value: string | null): number {
  if (value === null) return 0;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function PostDetailComments({
  postId,
  count,
  onCountChange,
  sectionRef,
}: {
  postId: string;
  count: number;
  onCountChange: Dispatch<SetStateAction<number>>;
  sectionRef: RefObject<HTMLDivElement | null>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const commentsPage = parseCommentsPage(searchParams.get("commentsPage"));
  const rawCommentsPage = searchParams.get("commentsPage");
  const targetCommentId = searchParams.get("commentId")?.trim() || null;

  const updateCommentsPage = useCallback((page: number, replace = false, preserveTarget = false) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("commentsPage", Math.max(0, page).toString());
    if (!preserveTarget) params.delete("commentId");
    const href = `/posts/${encodeURIComponent(postId)}?${params.toString()}`;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [postId, router, searchParams]);

  useEffect(() => {
    if (rawCommentsPage !== null && rawCommentsPage !== commentsPage.toString()) {
      updateCommentsPage(commentsPage, true, !!targetCommentId);
    }
  }, [commentsPage, rawCommentsPage, targetCommentId, updateCommentsPage]);

  const comments = usePagedComments<PostComment>({
    scopeId: postId,
    page: commentsPage,
    targetCommentId,
    maxLength: MAX_COMMENT_LENGTH,
    fetchPage: (page, size) => fetchPostCommentsPage(postId, { page, size }),
    fetchTargetLocation: (commentId, size) => fetchPostCommentPageLocation(postId, commentId, size),
    createComment: (text) => apiPost<PostComment>(`/api/posts/${postId}/comments`, { text }),
    updateComment: (commentId, text) => updatePostComment(postId, commentId, { text }),
    removeComment: (commentId) => apiDeleteVoid(`/api/posts/${postId}/comments/${commentId}`),
    onPageChange: (page, { replace, preserveTarget }) => updateCommentsPage(page, replace, preserveTarget),
    listNotFoundMessage: "게시글을 찾을 수 없습니다.",
    onMutationError: (message) => toast.error(message),
    onTotalElements: (total) => onCountChange(total),
    onCountDelta: (delta) => onCountChange((current) => Math.max(0, current + delta)),
    onRequireLogin: () => toast.error("로그인이 필요합니다."),
  });

  const {
    token,
    composeText,
    setComposeText,
    submitting,
    deletingIds,
    editingCommentId,
    editText,
    setEditText,
    editError,
    savingCommentId,
    targetNotice,
    listError,
  } = comments;
  const visibleComments = comments.response?.content ?? [];
  const visibleCommentsLoading = comments.status === "loading";

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  // 좋아요 토글 응답을 다음 목록 fetch 전까지 덮어쓴다(페이지 데이터는 서버가 진실).
  const [likeOverrides, setLikeOverrides] = useState<Record<string, CommentLikeStatus>>({});
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());

  // 새 페이지 응답이 오면 덮어쓰기를 비운다 — effect 대신 렌더 중 이전 값 비교(공식 권장 패턴).
  const [overridesResponse, setOverridesResponse] = useState(comments.response);
  if (overridesResponse !== comments.response) {
    setOverridesResponse(comments.response);
    setLikeOverrides({});
  }

  const likeStateOf = (c: PostComment): CommentLikeStatus =>
    likeOverrides[c.id] ?? { likes: c.likes ?? 0, likedByMe: c.likedByMe ?? false };

  const toggleLike = async (c: PostComment) => {
    const requestToken = getSessionId();
    if (!requestToken) {
      toast.error("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    if (likingIds.has(c.id)) return;
    setLikingIds((prev) => new Set(prev).add(c.id));
    try {
      const status = likeStateOf(c).likedByMe
        ? await unlikePostComment(postId, c.id)
        : await likePostComment(postId, c.id);
      if (getSessionId() !== requestToken) return;
      setLikeOverrides((prev) => ({ ...prev, [c.id]: status }));
    } catch (error) {
      if (getSessionId() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        toast.error("로그인이 필요합니다.");
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 404) {
        toast.error("댓글을 찾을 수 없습니다.");
        comments.reload();
      } else {
        toast.error("좋아요 처리에 실패했습니다.");
      }
    } finally {
      setLikingIds((prev) => {
        const next = new Set(prev);
        next.delete(c.id);
        return next;
      });
    }
  };

  const toggleReplying = (commentId: string) => {
    setReplyingToId((current) => (current === commentId ? null : commentId));
    setReplyText("");
  };

  const submitReply = async (parentId: string) => {
    const text = replyText.trim();
    if (!text || submittingReply) return;
    const requestToken = getSessionId();
    if (!requestToken) {
      toast.error("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    setSubmittingReply(true);
    try {
      await apiPost<PostComment>(`/api/posts/${postId}/comments`, { text, parentId });
      if (getSessionId() !== requestToken) return;
      onCountChange((current) => current + 1);
      setReplyText("");
      setReplyingToId(null);
      comments.reload();
    } catch (error) {
      if (getSessionId() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        toast.error("로그인이 필요합니다.");
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 404) {
        toast.error("원본 댓글이 삭제되어 답글을 남길 수 없습니다.");
        setReplyingToId(null);
        comments.reload();
      } else if (error instanceof ApiError && error.status === 400) {
        toast.error("답글 내용을 확인해주세요.");
      } else {
        toast.error("답글 등록에 실패했습니다.");
      }
    } finally {
      setSubmittingReply(false);
    }
  };

  const renderComment = (c: PostComment, isReply: boolean) => (
    <div
      id={`comment-${c.id}`}
      className="flex scroll-mt-28 gap-3 rounded-2xl p-3 transition-colors"
      style={{
        background: c.id === targetCommentId
          ? "var(--accent-soft)"
          : "transparent",
        outline: c.id === targetCommentId ? "1px solid rgba(125,211,163,0.55)" : "none",
      }}
    >
      <Avatar
        name={c.author.name}
        verified={c.author.verified}
        size={isReply ? 30 : 36}
        src={c.author.profileImageUrl ?? undefined}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="truncate" style={{ color: "var(--foreground)" }}>{c.author.name}</span>
          <span className="shrink-0 opacity-50" style={{ color: "var(--foreground)" }}>
            · {c.time}{c.edited ? " · 수정됨" : ""}
          </span>
          {c.ownedByMe && (
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {editingCommentId !== c.id ? (
                <button
                  type="button"
                  onClick={() => comments.startEditing(c)}
                  disabled={savingCommentId !== null || deletingIds.has(c.id)}
                  aria-label={isReply ? "답글 수정" : "댓글 수정"}
                  className="flex h-8 w-8 items-center justify-center rounded-full disabled:cursor-wait disabled:opacity-40"
                  style={{ background: "rgba(125,211,163,0.14)", color: "var(--accent-strong)" }}
                >
                  <Pencil size={14} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void comments.remove(c.id)}
                disabled={deletingIds.has(c.id) || savingCommentId === c.id}
                aria-label={isReply ? "답글 삭제" : "댓글 삭제"}
                className="flex h-8 w-8 items-center justify-center rounded-full disabled:cursor-wait disabled:opacity-40"
                style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
          {!c.ownedByMe ? (
            <ReportButton
              targetType="POST_COMMENT"
              targetId={c.id}
              ownedByMe={false}
              className="ml-auto !px-2.5 !py-1.5"
            />
          ) : null}
        </div>
        {c.ownedByMe && editingCommentId === c.id ? (
          <form
            className="mt-3 space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void comments.saveEditing(c.id);
            }}
          >
            <textarea
              aria-label="댓글 수정 내용"
              autoFocus
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
              rows={3}
              disabled={savingCommentId === c.id}
              className="ui-control resize-none bg-transparent px-3 py-2"
              style={{ borderColor: "rgba(var(--ink-rgb), 0.15)", color: "var(--foreground)" }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] opacity-55" style={{ color: "var(--foreground)" }}>
                {editText.length} / {MAX_COMMENT_LENGTH}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={comments.cancelEditing}
                  disabled={savingCommentId === c.id}
                  className="rounded-full px-3 py-1.5 text-[12px] disabled:opacity-40"
                  style={{ background: "var(--border)", color: "var(--foreground)" }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={savingCommentId === c.id || !editText.trim()}
                  className="rounded-full bg-[#7dd3a3] px-3 py-1.5 text-[12px] text-[#0f1f22] disabled:opacity-40"
                >
                  {savingCommentId === c.id ? "저장 중…" : "저장"}
                </button>
              </div>
            </div>
            {editError ? <p role="alert" className="text-[12px]" style={{ color: "var(--danger)" }}>{editError}</p> : null}
          </form>
        ) : (
          <>
            <p className="mt-0.5 whitespace-pre-wrap break-words" style={{ color: "rgba(var(--ink-rgb), 0.85)" }}>
              <MentionText text={c.text} />
            </p>
            <div className="mt-1 flex items-center gap-3">
              {(() => {
                const { likes, likedByMe } = likeStateOf(c);
                return (
                  <button
                    type="button"
                    onClick={() => void toggleLike(c)}
                    disabled={likingIds.has(c.id)}
                    aria-label={likedByMe ? "이 댓글 좋아요 취소" : "이 댓글 좋아요"}
                    aria-pressed={likedByMe}
                    className="inline-flex items-center gap-1 text-[12px] hover:opacity-100 disabled:opacity-40"
                    style={{
                      color: likedByMe ? "#ed5c48" : "var(--foreground)",
                      opacity: likedByMe ? 1 : 0.55,
                    }}
                  >
                    <Heart size={12} fill={likedByMe ? "#ed5c48" : "transparent"} aria-hidden />
                    {likes}
                  </button>
                );
              })()}
              {!isReply && token ? (
                <button
                  type="button"
                  onClick={() => toggleReplying(c.id)}
                  className="inline-flex items-center gap-1 text-[12px] opacity-55 hover:opacity-100"
                  style={{ color: "var(--foreground)" }}
                >
                  <CornerDownRight size={12} aria-hidden />
                  {replyingToId === c.id ? "답글 취소" : "답글 달기"}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div
      ref={sectionRef}
      className="mt-8 scroll-mt-24 rounded-3xl border p-5 sm:p-8"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <h3 className="mb-6" style={{ fontFamily: "var(--font-black-han), sans-serif", fontSize: 22, color: "var(--foreground)" }}>
        댓글 {count}
      </h3>
      <div
        className="flex items-center gap-3 p-3 rounded-2xl mb-6"
        style={{ background: "rgba(var(--ink-rgb), 0.04)" }}
      >
        {token ? (
          <>
            <CurrentUserAvatar size={36} />
            <input
              aria-label="댓글 내용"
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void comments.submit();
                }
              }}
              placeholder="댓글 달기..."
              maxLength={MAX_COMMENT_LENGTH}
              disabled={submitting || visibleCommentsLoading || !!listError}
              className="flex-1 bg-transparent outline-none placeholder:opacity-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3a3]"
              style={{ color: "var(--foreground)" }}
            />
            <button
              type="button"
              onClick={() => void comments.submit()}
              disabled={submitting || visibleCommentsLoading || !!listError || !composeText.trim()}
              aria-label="댓글 등록"
              className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40"
              style={{ background: "#7dd3a3", color: "#0f1f22" }}
            >
              <Send size={14} />
            </button>
          </>
        ) : (
          <div className="flex w-full flex-col items-center gap-3 py-2 text-center">
            <p className="text-[13px]" style={{ color: "rgba(var(--ink-rgb), 0.7)" }}>
              로그인해야 댓글을 작성할 수 있어요.
            </p>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]"
            >
              로그인하기
            </button>
          </div>
        )}
      </div>
      <div className="space-y-5 min-h-[64px]">
        {targetNotice ? (
          <p role="alert" className="text-[13px]" style={{ color: "var(--danger)" }}>
            {targetNotice}
          </p>
        ) : null}
        {visibleCommentsLoading ? (
          <p className="text-[13px] opacity-50" style={{ color: "var(--foreground)" }}>댓글을 불러오는 중…</p>
        ) : listError ? (
          <div className="flex items-center gap-3">
            <p className="text-[13px]" style={{ color: "var(--danger)" }}>{listError}</p>
            <button
              onClick={comments.reload}
              className="text-[12px] px-3 py-1 rounded-full"
              style={{ background: "var(--border)", color: "var(--foreground)" }}
            >
              다시 시도
            </button>
          </div>
        ) : visibleComments.length === 0 ? (
          <p className="text-[13px] opacity-50" style={{ color: "var(--foreground)" }}>첫 댓글을 남겨보세요.</p>
        ) : (
          visibleComments.map((c) => (
            <div key={c.id}>
              {renderComment(c, false)}
              {(c.replies?.length ?? 0) > 0 || replyingToId === c.id ? (
                <div className="ml-8 mt-1 space-y-1 border-l pl-3 sm:ml-12" style={{ borderColor: "var(--border)" }}>
                  {c.replies?.map((reply) => (
                    <div key={reply.id}>{renderComment(reply, true)}</div>
                  ))}
                  {replyingToId === c.id ? (
                    <div
                      className="flex items-center gap-2 rounded-2xl p-2.5"
                      style={{ background: "rgba(var(--ink-rgb), 0.04)" }}
                    >
                      <CornerDownRight size={14} className="shrink-0 opacity-45" aria-hidden />
                      <input
                        aria-label="답글 내용"
                        autoFocus
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            void submitReply(c.id);
                          }
                        }}
                        placeholder={`${c.author.name}님에게 답글 달기...`}
                        maxLength={MAX_COMMENT_LENGTH}
                        disabled={submittingReply}
                        className="min-w-0 flex-1 bg-transparent outline-none placeholder:opacity-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3a3]"
                        style={{ color: "var(--foreground)" }}
                      />
                      <button
                        type="button"
                        onClick={() => void submitReply(c.id)}
                        disabled={submittingReply || !replyText.trim()}
                        aria-label="답글 등록"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
                        style={{ background: "#7dd3a3", color: "#0f1f22" }}
                      >
                        <Send size={13} />
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
      {comments.status === "success" && comments.response && comments.response.totalElements > 0 ? (
        <Pagination
          page={comments.response.page}
          totalPages={comments.response.totalPages}
          totalElements={comments.response.totalElements}
          compact
          className="mt-7"
          onPageChange={updateCommentsPage}
        />
      ) : null}
    </div>
  );
}

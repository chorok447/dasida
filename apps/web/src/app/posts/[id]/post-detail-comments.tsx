"use client";

import { toast } from "sonner";
import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Send, Trash2 } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { apiPost, apiDeleteVoid, ApiError, apiErrorMessage } from "@/lib/api";
import { getSessionId, clearSession } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { Avatar } from "@/components/avatar";
import { ReportButton } from "@/components/report-button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import {
  fetchPostCommentPageLocation,
  fetchPostCommentsPage,
  updatePostComment,
  type PostComment,
  type PostCommentsPageResponse,
} from "@/data/posts";

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
  const { sessionId: token } = useAuthSession();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const confirm = useConfirm();

  const commentsPage = parseCommentsPage(searchParams.get("commentsPage"));
  const rawCommentsPage = searchParams.get("commentsPage");
  const targetCommentId = searchParams.get("commentId")?.trim() || null;
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
  const targetIdentity = JSON.stringify([postId, targetCommentId]);
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
    postId,
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
    const href = `/posts/${encodeURIComponent(postId)}?${params.toString()}`;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [postId, router, searchParams]);

  useEffect(() => {
    if (rawCommentsPage !== null && rawCommentsPage !== commentsPage.toString()) {
      updateCommentsPage(commentsPage, true, !!targetCommentId);
    }
  }, [commentsPage, rawCommentsPage, targetCommentId, updateCommentsPage]);

  useEffect(() => {
    if (!targetCommentId) return;
    const generation = ++targetRequestGenerationRef.current;
    let cancelled = false;
    const isCurrent = () => !cancelled && generation === targetRequestGenerationRef.current;

    fetchPostCommentPageLocation(postId, targetCommentId, 20)
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
  }, [commentsPage, postId, rawCommentsPage, targetCommentId, targetIdentity, updateCommentsPage]);

  useEffect(() => {
    if (targetLocationStatus === "loading") return;
    if (targetLocationPage !== undefined && targetLocationPage !== null && targetLocationPage !== commentsPage) return;
    const requestToken = token;
    const generation = ++commentsRequestGenerationRef.current;
    let cancelled = false;
    const isCurrent = () =>
      !cancelled &&
      generation === commentsRequestGenerationRef.current &&
      getSessionId() === requestToken;

    fetchPostCommentsPage(postId, { page: commentsPage, size: 20 })
      .then((response) => {
        if (!isCurrent()) return;
        if (response.content.length === 0 && commentsPage > 0) {
          const previousPage = response.totalPages > 0
            ? Math.min(commentsPage - 1, response.totalPages - 1)
            : 0;
          updateCommentsPage(previousPage, true);
          return;
        }
        onCountChange(response.totalElements);
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
          toast.error("로그인이 필요합니다.");
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
  }, [commentsPage, commentsRequestIdentity, onCountChange, postId, router, targetLocationPage, targetLocationStatus, token, updateCommentsPage]);

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
    if (!text || submittingComment || visibleCommentsLoading || commentsError) return;
    if (text.length > MAX_COMMENT_LENGTH) {
      toast.error(`댓글은 ${MAX_COMMENT_LENGTH}자 이하여야 합니다.`);
      return;
    }
    if (!getSessionId()) {
      toast.error("로그인해야 댓글을 작성할 수 있어요.");
      router.push("/login");
      return;
    }
    setSubmittingComment(true);
    const requestToken = getSessionId();
    try {
      await apiPost<PostComment>(`/api/posts/${postId}/comments`, { text });
      if (getSessionId() !== requestToken) return;
      onCountChange((c) => c + 1);
      setCommentText("");
      if (commentsPage === 0 && rawCommentsPage === "0") {
        retryComments();
      } else {
        updateCommentsPage(0, commentsPage === 0);
      }
    } catch (e) {
      if (getSessionId() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        toast.error("로그인해야 댓글을 작성할 수 있어요.");
        router.push("/login");
      } else {
        toast.error("댓글 작성에 실패했습니다.");
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    const requestToken = getSessionId();
    if (!requestToken) {
      clearSession();
      toast.error("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    if (deletingCommentIdsRef.current.has(commentId)) return;
    if (!(await confirm({ message: "이 댓글을 삭제할까요?", destructive: true, confirmLabel: "삭제" }))) return;

    deletingCommentIdsRef.current.add(commentId);
    setDeletingCommentIds(new Set(deletingCommentIdsRef.current));
    try {
      await apiDeleteVoid(`/api/posts/${postId}/comments/${commentId}`);
      if (getSessionId() !== requestToken) return;
      onCountChange((current) => Math.max(0, current - 1));
      const response = currentCommentsState.response;
      if (response && response.content.length === 1 && commentsPage > 0) {
        updateCommentsPage(commentsPage - 1);
      } else {
        retryComments();
      }
    } catch (error) {
      if (getSessionId() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        toast.error("로그인이 필요합니다.");
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 403) {
        toast.error("댓글 삭제 권한이 없습니다.");
      } else if (error instanceof ApiError && error.status === 404) {
        toast.error("이미 삭제되었거나 존재하지 않는 댓글입니다.");
        retryComments();
      } else {
        toast.error("댓글 삭제에 실패했습니다.");
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
    const requestToken = getSessionId();
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
      const updated = await updatePostComment(postId, commentId, { text });
      if (getSessionId() !== requestToken || generation !== editRequestGenerationRef.current) return;
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
      if (getSessionId() !== requestToken || generation !== editRequestGenerationRef.current) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        setEditingCommentId(null);
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 403) {
        toast.error("댓글을 수정할 권한이 없습니다.");
        setEditingCommentId(null);
        retryComments();
      } else if (error instanceof ApiError && error.status === 404) {
        toast.error("댓글을 찾을 수 없습니다.");
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

  return (
    <div
      ref={sectionRef}
      className="mt-8 scroll-mt-24 rounded-3xl border p-5 sm:p-8"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <h3 className="mb-6" style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 22, color: dark ? "#f9f7f2" : "#0f1f22" }}>
        댓글 {count}
      </h3>
      <div
        className="flex items-center gap-3 p-3 rounded-2xl mb-6"
        style={{ background: dark ? "rgba(255,255,255,0.04)" : "rgba(28,64,68,0.04)" }}
      >
        {token ? (
          <>
            <Avatar name="나" size={36} />
            <input
              aria-label="댓글 내용"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
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
          </>
        ) : (
          <div className="flex w-full flex-col items-center gap-3 py-2 text-center">
            <p className="text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}>
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
              <Avatar
                name={c.author.name}
                verified={c.author.verified}
                size={36}
                src={c.author.profileImageUrl ?? undefined}
              />
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
  );
}

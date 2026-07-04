"use client";

import { toast } from "sonner";
import { useCallback, useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Send, Trash2 } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { apiPost, apiDeleteVoid } from "@/lib/api";
import { usePagedComments } from "@/lib/use-paged-comments";
import { Avatar } from "@/components/avatar";
import { CurrentUserAvatar } from "@/components/current-user-avatar";
import { ReportButton } from "@/components/report-button";
import { Pagination } from "@/components/ui/pagination";
import {
  fetchPostCommentPageLocation,
  fetchPostCommentsPage,
  updatePostComment,
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
  const { theme } = useTheme();
  const dark = theme === "dark";

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
              className="flex-1 bg-transparent outline-none placeholder:opacity-50 disabled:opacity-50"
              style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
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
        {targetNotice ? (
          <p role="alert" className="text-[13px]" style={{ color: "#ed5c48" }}>
            {targetNotice}
          </p>
        ) : null}
        {visibleCommentsLoading ? (
          <p className="text-[13px] opacity-50" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>댓글을 불러오는 중…</p>
        ) : listError ? (
          <div className="flex items-center gap-3">
            <p className="text-[13px]" style={{ color: "#ed5c48" }}>{listError}</p>
            <button
              onClick={comments.reload}
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
                          onClick={() => comments.startEditing(c)}
                          disabled={savingCommentId !== null || deletingIds.has(c.id)}
                          aria-label="댓글 수정"
                          className="flex h-8 w-8 items-center justify-center rounded-full disabled:cursor-wait disabled:opacity-40"
                          style={{ background: "rgba(125,211,163,0.14)", color: dark ? "#7dd3a3" : "#148a90" }}
                        >
                          <Pencil size={14} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void comments.remove(c.id)}
                        disabled={deletingIds.has(c.id) || savingCommentId === c.id}
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
                      style={{ borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(28,64,68,0.15)", color: dark ? "#f9f7f2" : "#0f1f22" }}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] opacity-55" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
                        {editText.length} / {MAX_COMMENT_LENGTH}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={comments.cancelEditing}
                          disabled={savingCommentId === c.id}
                          className="rounded-full px-3 py-1.5 text-[12px] disabled:opacity-40"
                          style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)", color: dark ? "#f9f7f2" : "#0f1f22" }}
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
                    {editError ? <p role="alert" className="text-[12px] text-[#ed5c48]">{editError}</p> : null}
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

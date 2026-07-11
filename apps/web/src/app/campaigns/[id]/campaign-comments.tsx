"use client";

import { type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CornerDownRight, Loader2, MessageCircle, RefreshCw, Send } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import {
  fetchCampaignCommentPageLocation,
  updateCampaignComment,
  type CampaignComment,
  type CampaignCommentsResponse,
} from "@/data/campaigns";
import { ApiError, apiDeleteVoid, apiGet, apiPost } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
import { usePagedComments } from "@/lib/use-paged-comments";
import { CampaignCommentItem } from "./campaign-comment-item";
import { CampaignCommentCompose } from "./campaign-comment-compose";

export function CampaignComments({
  campaignId,
  targetCommentId,
}: {
  campaignId: string;
  targetCommentId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(0);
  const [mutationError, setMutationError] = useState("");

  const clearTargetComment = () => {
    if (!targetCommentId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("commentId");
    const query = params.toString();
    router.replace(`/campaigns/${encodeURIComponent(campaignId)}${query ? `?${query}` : ""}`, { scroll: false });
  };

  const comments = usePagedComments<CampaignComment>({
    scopeId: campaignId,
    page,
    targetCommentId,
    fetchPage: (nextPage, size) =>
      apiGet<CampaignCommentsResponse>(`/api/campaigns/${campaignId}/comments?page=${nextPage}&size=${size}`),
    fetchTargetLocation: (commentId, size) => fetchCampaignCommentPageLocation(campaignId, commentId, size),
    createComment: (text) => apiPost<CampaignComment>(`/api/campaigns/${campaignId}/comments`, { text }),
    updateComment: (commentId, text) => updateCampaignComment(campaignId, commentId, { text }),
    removeComment: (commentId) => apiDeleteVoid(`/api/campaigns/${campaignId}/comments/${commentId}`),
    onPageChange: (nextPage, { preserveTarget }) => {
      if (!preserveTarget) clearTargetComment();
      setPage(Math.max(0, nextPage));
    },
    listNotFoundMessage: "캠페인을 찾을 수 없습니다.",
    onMutationError: setMutationError,
    onMutationErrorClear: () => setMutationError(""),
    onAfterMutation: clearTargetComment,
  });

  const {
    token,
    reload,
    targetNotice,
    composeText,
    setComposeText,
    submitting,
    deletingIds,
    editingCommentId,
    editText,
    setEditText,
    editError,
    savingCommentId,
  } = comments;
  const response = comments.response;

  const changePage = (nextPage: number) => {
    clearTargetComment();
    setPage(Math.max(0, nextPage));
  };

  const submitComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void comments.submit();
  };

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  const toggleReplying = (comment: CampaignComment) => {
    setReplyingToId((current) => (current === comment.id ? null : comment.id));
    setReplyText("");
  };

  const submitReply = async (parentId: string) => {
    const text = replyText.trim();
    if (!text || submittingReply) return;
    const requestToken = getSessionId();
    if (!requestToken) {
      router.push("/login");
      return;
    }
    setSubmittingReply(true);
    setMutationError("");
    try {
      await apiPost<CampaignComment>(`/api/campaigns/${campaignId}/comments`, { text, parentId });
      if (getSessionId() !== requestToken) return;
      setReplyText("");
      setReplyingToId(null);
      reload();
    } catch (error) {
      if (getSessionId() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 404) {
        setMutationError("원본 댓글이 삭제되어 답글을 남길 수 없습니다.");
        setReplyingToId(null);
        reload();
      } else if (error instanceof ApiError && error.status === 400) {
        setMutationError("답글 내용을 확인해주세요.");
      } else {
        setMutationError("답글 등록에 실패했습니다.");
      }
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div
      className="rounded-3xl border p-5 sm:p-8"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold" style={{ color: "var(--foreground)" }}>
            댓글 {comments.status === "success" && response
              ? (response.totalComments ?? response.totalElements).toLocaleString()
              : ""}
          </h2>
          <p className="mt-1 text-[12px] opacity-60" style={{ color: "var(--foreground)" }}>
            캠페인에 대한 의견과 질문을 남겨보세요.
          </p>
        </div>
        <button
          type="button"
          aria-label="댓글 새로고침"
          onClick={reload}
          disabled={comments.status === "loading"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-45"
          style={{ background: "rgba(var(--ink-rgb), 0.07)", color: "var(--heading)" }}
        >
          <RefreshCw size={16} className={comments.status === "loading" ? "animate-spin" : ""} />
        </button>
      </div>

      <CampaignCommentCompose
        token={token}
        text={composeText}
        submitting={submitting}
        mutationError={mutationError}
        onTextChange={setComposeText}
        onSubmit={submitComment}
      />
      {targetNotice ? (
        <p role="alert" className="mt-3 text-[12px] text-[#ed5c48]">{targetNotice}</p>
      ) : null}

      <div className="mt-7 space-y-3">
        {comments.status === "loading" ? (
          <StatePanel compact>
            <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
            <p style={{ color: "var(--foreground-muted)" }}>댓글을 불러오는 중입니다.</p>
          </StatePanel>
        ) : null}

        {comments.status === "error" ? (
          <StatePanel compact role="alert">
            <p style={{ color: "var(--foreground-muted)" }}>{comments.listError}</p>
            <button type="button" onClick={reload} className="rounded-full bg-[var(--accent)] px-5 py-2 text-[13px] text-[#0f1f22]">
              다시 시도
            </button>
          </StatePanel>
        ) : null}

        {comments.status === "success" && response?.content.length === 0 ? (
          <StatePanel compact>
            <MessageCircle size={26} className="opacity-35" />
            <p style={{ color: "rgba(var(--ink-rgb), 0.6)" }}>아직 작성된 댓글이 없습니다.</p>
          </StatePanel>
        ) : null}

        {comments.status === "success" && response ? response.content.map((comment) => (
          <div key={comment.id}>
            <CampaignCommentItem
              comment={comment}
              deleting={deletingIds.has(comment.id)}
              editing={editingCommentId === comment.id && comment.ownedByMe}
              saving={savingCommentId === comment.id}
              editText={editingCommentId === comment.id ? editText : comment.text}
              editError={editingCommentId === comment.id ? editError : ""}
              highlighted={comment.id === targetCommentId}
              onEdit={comments.startEditing}
              onEditTextChange={setEditText}
              onSave={(target) => void comments.saveEditing(target.id)}
              onCancel={comments.cancelEditing}
              onDelete={(target) => void comments.remove(target.id)}
              replying={replyingToId === comment.id}
              onToggleReply={token ? toggleReplying : undefined}
            />
            {(comment.replies?.length ?? 0) > 0 || replyingToId === comment.id ? (
              <div className="ml-6 mt-2 space-y-2 border-l pl-3 sm:ml-10" style={{ borderColor: "var(--border)" }}>
                {comment.replies?.map((reply) => (
                  <CampaignCommentItem
                    key={reply.id}
                    comment={reply}
                    isReply
                    deleting={deletingIds.has(reply.id)}
                    editing={editingCommentId === reply.id && reply.ownedByMe}
                    saving={savingCommentId === reply.id}
                    editText={editingCommentId === reply.id ? editText : reply.text}
                    editError={editingCommentId === reply.id ? editError : ""}
                    highlighted={reply.id === targetCommentId}
                    onEdit={comments.startEditing}
                    onEditTextChange={setEditText}
                    onSave={(target) => void comments.saveEditing(target.id)}
                    onCancel={comments.cancelEditing}
                    onDelete={(target) => void comments.remove(target.id)}
                  />
                ))}
                {replyingToId === comment.id ? (
                  <div
                    className="flex items-center gap-2 rounded-2xl border p-3"
                    style={{ borderColor: "var(--border)" }}
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
                          void submitReply(comment.id);
                        }
                      }}
                      placeholder={`${comment.author.name}님에게 답글 달기...`}
                      maxLength={500}
                      disabled={submittingReply}
                      className="min-w-0 flex-1 bg-transparent outline-none placeholder:opacity-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      style={{ color: "var(--foreground)" }}
                    />
                    <button
                      type="button"
                      onClick={() => void submitReply(comment.id)}
                      disabled={submittingReply || !replyText.trim()}
                      aria-label="답글 등록"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
                      style={{ background: "var(--accent)", color: "#0f1f22" }}
                    >
                      {submittingReply ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )) : null}
      </div>

      {comments.status === "success" && response && response.totalElements > 0 ? (
        <Pagination
          page={response.page}
          totalPages={response.totalPages}
          totalElements={response.totalElements}
          compact
          className="mt-7"
          onPageChange={changePage}
        />
      ) : null}
    </div>
  );
}

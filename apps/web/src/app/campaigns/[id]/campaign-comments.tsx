"use client";

import { type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import {
  fetchCampaignCommentPageLocation,
  updateCampaignComment,
  type CampaignComment,
  type CampaignCommentsResponse,
} from "@/data/campaigns";
import { apiDeleteVoid, apiGet, apiPost } from "@/lib/api";
import { usePagedComments } from "@/lib/use-paged-comments";
import { useTheme } from "@/lib/theme-context";
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
  const { theme } = useTheme();
  const dark = theme === "dark";
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

  return (
    <div
      className="rounded-3xl border p-5 sm:p-8"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold" style={{ color: "var(--foreground)" }}>
            댓글 {comments.status === "success" && response ? response.totalElements.toLocaleString() : ""}
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
          style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.06)", color: dark ? "#f9f7f2" : "#1c4044" }}
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
            <Loader2 size={24} className="animate-spin text-[#7dd3a3]" />
            <p style={{ color: "var(--foreground-muted)" }}>댓글을 불러오는 중입니다.</p>
          </StatePanel>
        ) : null}

        {comments.status === "error" ? (
          <StatePanel compact role="alert">
            <p style={{ color: "var(--foreground-muted)" }}>{comments.listError}</p>
            <button type="button" onClick={reload} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
              다시 시도
            </button>
          </StatePanel>
        ) : null}

        {comments.status === "success" && response?.content.length === 0 ? (
          <StatePanel compact>
            <MessageCircle size={26} className="opacity-35" />
            <p style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>아직 작성된 댓글이 없습니다.</p>
          </StatePanel>
        ) : null}

        {comments.status === "success" && response ? response.content.map((comment) => (
          <CampaignCommentItem
            key={comment.id}
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
          />
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

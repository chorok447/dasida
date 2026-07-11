"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CornerDownRight, Heart, Loader2, Pencil, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
import { Avatar } from "@/components/avatar";
import { MentionText } from "@/components/mention-text";
import { ReportButton } from "@/components/report-button";
import {
  likeCampaignComment,
  unlikeCampaignComment,
  type CampaignComment,
  type CampaignCommentLikeStatus,
} from "@/data/campaigns";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export function CampaignCommentItem({
  comment,
  deleting,
  editing,
  saving,
  editText,
  editError,
  highlighted,
  onEdit,
  onEditTextChange,
  onSave,
  onCancel,
  onDelete,
  isReply = false,
  replying = false,
  onToggleReply,
}: {
  comment: CampaignComment;
  deleting: boolean;
  editing: boolean;
  saving: boolean;
  editText: string;
  editError: string;
  highlighted: boolean;
  onEdit: (comment: CampaignComment) => void;
  onEditTextChange: (value: string) => void;
  onSave: (comment: CampaignComment) => void;
  onCancel: () => void;
  onDelete: (comment: CampaignComment) => void;
  isReply?: boolean;
  replying?: boolean;
  /** 최상위 댓글에서 답글 작성 UI 를 토글한다. 없으면 답글 버튼을 숨긴다. */
  onToggleReply?: (comment: CampaignComment) => void;
}) {
  const router = useRouter();
  // 좋아요 토글 응답을 다음 목록 fetch 전까지 덮어쓴다(comment prop 이 갱신되면 초기화 — 렌더 중 이전 값 비교 패턴).
  const [likeOverride, setLikeOverride] = useState<CampaignCommentLikeStatus | null>(null);
  const [likeSyncedFor, setLikeSyncedFor] = useState(comment);
  if (likeSyncedFor !== comment) {
    setLikeSyncedFor(comment);
    setLikeOverride(null);
  }
  const [likeBusy, setLikeBusy] = useState(false);
  const likes = likeOverride?.likes ?? comment.likes ?? 0;
  const likedByMe = likeOverride?.likedByMe ?? comment.likedByMe ?? false;

  const toggleLike = async () => {
    const requestToken = getSessionId();
    if (!requestToken) {
      toast.error("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);
    try {
      const status = likedByMe
        ? await unlikeCampaignComment(comment.campaignId, comment.id)
        : await likeCampaignComment(comment.campaignId, comment.id);
      if (getSessionId() !== requestToken) return;
      setLikeOverride(status);
    } catch (error) {
      if (getSessionId() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        toast.error("로그인이 필요합니다.");
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 404) {
        toast.error("댓글을 찾을 수 없습니다.");
      } else {
        toast.error("좋아요 처리에 실패했습니다.");
      }
    } finally {
      setLikeBusy(false);
    }
  };

  return (
    <article
      id={`comment-${comment.id}`}
      className="scroll-mt-28 rounded-2xl border p-5 transition-colors"
      style={{
        background: highlighted ? "var(--accent-soft)" : "var(--glass)",
        borderColor: highlighted
          ? "rgba(125,211,163,0.65)"
          : "var(--border)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar
            name={comment.author.name}
            verified={comment.author.verified}
            size={36}
            src={comment.author.profileImageUrl ?? undefined}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                {comment.author.name}
              </span>
              {comment.author.verified ? (
                <span className="rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-[10px] text-[#148a90]">인증</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1 text-[11px] opacity-55" style={{ color: "var(--foreground)" }}>
              <time dateTime={comment.createdAt}>{formatCreatedAt(comment.createdAt)}</time>
              {comment.edited ? <span>· 수정됨</span> : null}
            </div>
          </div>
        </div>
        {comment.ownedByMe ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {!editing ? (
              <button
                type="button"
                aria-label={`${comment.author.name} 댓글 수정`}
                onClick={() => onEdit(comment)}
                disabled={deleting || saving}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-45"
                style={{ background: "rgba(125,211,163,0.14)", color: "var(--accent-strong)" }}
              >
                <Pencil size={15} />
              </button>
            ) : null}
            <button
              type="button"
              aria-label={`${comment.author.name} 댓글 삭제`}
              onClick={() => onDelete(comment)}
              disabled={deleting || saving}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: "var(--danger-soft)" }}
            >
              {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            </button>
          </div>
        ) : (
          <ReportButton
            targetType="CAMPAIGN_COMMENT"
            targetId={comment.id}
            ownedByMe={false}
            className="shrink-0 !px-2.5 !py-1.5"
          />
        )}
      </div>
      {editing ? (
        <form
          className="mt-4 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(comment);
          }}
        >
          <textarea
            aria-label="댓글 수정 내용"
            autoFocus
            value={editText}
            onChange={(event) => onEditTextChange(event.target.value)}
            maxLength={500}
            rows={4}
            disabled={saving}
            className="ui-control resize-none bg-transparent px-3 py-3"
            style={{ borderColor: "rgba(var(--ink-rgb), 0.14)", color: "var(--foreground)" }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] opacity-55" style={{ color: "var(--foreground)" }}>
              {editText.length} / 500
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="rounded-full px-4 py-2 text-[12px] disabled:opacity-40"
                style={{ background: "var(--border)", color: "var(--foreground)" }}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving || !editText.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-[12px] text-[var(--surface-dark)] disabled:opacity-40"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
          {editError ? <p role="alert" className="text-[12px] text-[var(--danger)]">{editError}</p> : null}
        </form>
      ) : (
        <>
          <p
            className="mt-4 whitespace-pre-wrap break-words text-[14px] leading-7"
            style={{ color: "var(--foreground-muted)" }}
          >
            <MentionText text={comment.text} />
          </p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void toggleLike()}
              disabled={likeBusy}
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
            {!isReply && onToggleReply ? (
              <button
                type="button"
                onClick={() => onToggleReply(comment)}
                className="inline-flex items-center gap-1 text-[12px] opacity-55 hover:opacity-100"
                style={{ color: "var(--foreground)" }}
              >
                <CornerDownRight size={12} aria-hidden />
                {replying ? "답글 취소" : "답글 달기"}
              </button>
            ) : null}
          </div>
        </>
      )}
    </article>
  );
}

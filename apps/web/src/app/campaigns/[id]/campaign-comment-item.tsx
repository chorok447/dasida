"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ReportButton } from "@/components/report-button";
import type { CampaignComment } from "@/data/campaigns";
import { useTheme } from "@/lib/theme-context";

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
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <article
      id={`comment-${comment.id}`}
      className="scroll-mt-28 rounded-2xl border p-5 transition-colors"
      style={{
        background: highlighted
          ? dark
            ? "rgba(125,211,163,0.16)"
            : "rgba(125,211,163,0.24)"
          : dark
            ? "rgba(255,255,255,0.025)"
            : "rgba(249,247,242,0.55)",
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
                style={{ background: "rgba(125,211,163,0.14)", color: dark ? "var(--accent)" : "#148a90" }}
              >
                <Pencil size={15} />
              </button>
            ) : null}
            <button
              type="button"
              aria-label={`${comment.author.name} 댓글 삭제`}
              onClick={() => onDelete(comment)}
              disabled={deleting || saving}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#ed5c48] disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: "rgba(237,92,72,0.12)" }}
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
            style={{ borderColor: dark ? "rgba(255,255,255,0.14)" : "rgba(28,64,68,0.14)", color: "var(--foreground)" }}
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
                style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)", color: "var(--foreground)" }}
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
          {editError ? <p role="alert" className="text-[12px] text-[#ed5c48]">{editError}</p> : null}
        </form>
      ) : (
        <p
          className="mt-4 whitespace-pre-wrap break-words text-[14px] leading-7"
          style={{ color: "var(--foreground-muted)" }}
        >
          {comment.text}
        </p>
      )}
    </article>
  );
}

"use client";

import { type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function CampaignCommentCompose({
  token,
  text,
  submitting,
  mutationError,
  onTextChange,
  onSubmit,
}: {
  token: string | null;
  text: string;
  submitting: boolean;
  mutationError: string;
  onTextChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const router = useRouter();

  return (
    <div className="mt-6">
      {token ? (
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border p-4"
          style={{ borderColor: "var(--border)" }}
        >
          <label htmlFor="campaign-comment" className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>
            댓글 작성
          </label>
          <textarea
            id="campaign-comment"
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            maxLength={500}
            rows={4}
            placeholder="댓글을 입력해주세요."
            className="ui-control mt-2 resize-none bg-transparent px-3 py-3"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] opacity-55" style={{ color: "var(--foreground)" }}>
              {text.length} / 500
            </span>
            <button
              type="submit"
              disabled={submitting || text.trim().length === 0}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {submitting ? "등록 중…" : "댓글 등록"}
            </button>
          </div>
        </form>
      ) : (
        <div
          className="flex flex-col items-center gap-3 rounded-2xl border px-5 py-6 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-[13px]" style={{ color: "var(--foreground-muted)" }}>
            로그인해야 댓글을 작성할 수 있어요.
          </p>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="rounded-full px-5 py-2 text-[13px]"
            style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
          >
            로그인하기
          </button>
        </div>
      )}
      {mutationError ? <p role="alert" className="mt-3 text-[12px] text-[#ed5c48]">{mutationError}</p> : null}
    </div>
  );
}

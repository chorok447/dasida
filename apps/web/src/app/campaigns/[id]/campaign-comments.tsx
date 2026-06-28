"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, MessageCircle, RefreshCw, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import type { CampaignComment, CampaignCommentsResponse } from "@/data/campaigns";
import { ApiError, apiDeleteVoid, apiGet, apiPost } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { useTheme } from "@/lib/theme-context";

type CommentListState = {
  identity: string;
  status: "loading" | "success" | "error";
  response: CampaignCommentsResponse | null;
  error: string;
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function CommentStatePanel({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center text-[13px]">{children}</div>;
}

function CommentItem({
  comment,
  deleting,
  onDelete,
}: {
  comment: CampaignComment;
  deleting: boolean;
  onDelete: (comment: CampaignComment) => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <article
      className="rounded-2xl border p-5"
      style={{
        background: dark ? "rgba(255,255,255,0.025)" : "rgba(249,247,242,0.55)",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={comment.author.name} verified={comment.author.verified} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[13px] font-medium" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
                {comment.author.name}
              </span>
              {comment.author.verified ? (
                <span className="rounded-full bg-[#7dd3a3]/20 px-2 py-0.5 text-[10px] text-[#148a90]">인증</span>
              ) : null}
            </div>
            <time className="text-[11px] opacity-55" dateTime={comment.createdAt} style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              {formatCreatedAt(comment.createdAt)}
            </time>
          </div>
        </div>
        {comment.ownedByMe ? (
          <button
            type="button"
            aria-label={`${comment.author.name} 댓글 삭제`}
            onClick={() => onDelete(comment)}
            disabled={deleting}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#ed5c48] disabled:cursor-not-allowed disabled:opacity-45"
            style={{ background: "rgba(237,92,72,0.12)" }}
          >
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </button>
        ) : null}
      </div>
      <p
        className="mt-4 whitespace-pre-wrap break-words text-[14px] leading-7"
        style={{ color: dark ? "rgba(255,255,255,0.78)" : "rgba(28,64,68,0.82)" }}
      >
        {comment.text}
      </p>
    </article>
  );
}

export function CampaignComments({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const { token } = useAuthSession();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [page, setPage] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const deletingRef = useRef(new Set<string>());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [mutationError, setMutationError] = useState("");
  const generationRef = useRef(0);
  const requestIdentity = JSON.stringify([campaignId, token, page, retryTick]);
  const [listState, setListState] = useState<CommentListState>({
    identity: "",
    status: "loading",
    response: null,
    error: "",
  });
  const currentState: CommentListState = listState.identity === requestIdentity
    ? listState
    : { identity: requestIdentity, status: "loading", response: null, error: "" };

  useEffect(() => {
    const requestToken = token;
    if (getToken() !== requestToken) return;

    const generation = ++generationRef.current;
    let cancelled = false;
    const isCurrent = () =>
      !cancelled && generation === generationRef.current && getToken() === requestToken;

    apiGet<CampaignCommentsResponse>(`/api/campaigns/${campaignId}/comments?page=${page}&size=20`)
      .then((response) => {
        if (!isCurrent()) return;
        if (response.content.length === 0 && page > 0 && response.totalPages > 0) {
          setPage(Math.min(page - 1, response.totalPages - 1));
          return;
        }
        setListState({ identity: requestIdentity, status: "success", response, error: "" });
      })
      .catch((error) => {
        if (!isCurrent()) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          router.push("/login");
          return;
        }
        setListState({
          identity: requestIdentity,
          status: "error",
          response: null,
          error: error instanceof ApiError && error.status === 404
            ? "캠페인을 찾을 수 없습니다."
            : "댓글을 불러오지 못했습니다.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId, page, requestIdentity, router, token]);

  const reload = () => setRetryTick((tick) => tick + 1);

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const requestToken = getToken();
    if (!requestToken) {
      router.push("/login");
      return;
    }
    const normalized = text.trim();
    if (!normalized || normalized.length > 500) {
      setMutationError("댓글은 1자 이상 500자 이하로 입력해주세요.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setMutationError("");
    try {
      await apiPost<CampaignComment>(`/api/campaigns/${campaignId}/comments`, { text: normalized });
      if (getToken() !== requestToken) return;
      setText("");
      if (page === 0) reload();
      else setPage(0);
    } catch (error) {
      if (getToken() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 400) {
        setMutationError("댓글은 1자 이상 500자 이하로 입력해주세요.");
      } else if (error instanceof ApiError && error.status === 404) {
        setMutationError("캠페인을 찾을 수 없습니다.");
      } else {
        setMutationError("댓글 등록에 실패했습니다.");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const refreshAfterDelete = () => {
    const response = currentState.response;
    if (response && response.content.length === 1 && page > 0) {
      setPage((current) => Math.max(0, current - 1));
    } else {
      reload();
    }
  };

  const deleteComment = async (comment: CampaignComment) => {
    if (deletingRef.current.has(comment.id)) return;
    const requestToken = getToken();
    if (!requestToken) {
      router.push("/login");
      return;
    }
    if (!confirm("이 댓글을 삭제할까요?")) return;

    deletingRef.current.add(comment.id);
    setDeletingIds((current) => new Set(current).add(comment.id));
    setMutationError("");
    try {
      await apiDeleteVoid(`/api/campaigns/${campaignId}/comments/${comment.id}`);
      if (getToken() !== requestToken) return;
      refreshAfterDelete();
    } catch (error) {
      if (getToken() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 403) {
        setMutationError("댓글 삭제 권한이 없습니다.");
      } else if (error instanceof ApiError && error.status === 404) {
        setMutationError("이미 삭제되었거나 존재하지 않는 댓글입니다.");
        refreshAfterDelete();
      } else {
        setMutationError("댓글 삭제에 실패했습니다.");
      }
    } finally {
      deletingRef.current.delete(comment.id);
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(comment.id);
        return next;
      });
    }
  };

  const response = currentState.response;

  return (
    <div
      className="rounded-3xl border p-5 sm:p-8"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
            댓글 {currentState.status === "success" && response ? response.totalElements.toLocaleString() : ""}
          </h2>
          <p className="mt-1 text-[12px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
            캠페인에 대한 의견과 질문을 남겨보세요.
          </p>
        </div>
        <button
          type="button"
          aria-label="댓글 새로고침"
          onClick={reload}
          disabled={currentState.status === "loading"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-45"
          style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.06)", color: dark ? "#f9f7f2" : "#1c4044" }}
        >
          <RefreshCw size={16} className={currentState.status === "loading" ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="mt-6">
        {token ? (
          <form onSubmit={submitComment} className="rounded-2xl border p-4" style={{ borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)" }}>
            <label htmlFor="campaign-comment" className="text-[12px] font-medium" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              댓글 작성
            </label>
            <textarea
              id="campaign-comment"
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={500}
              rows={4}
              placeholder="댓글을 입력해주세요."
              className="mt-2 w-full resize-none rounded-xl border bg-transparent px-3 py-3 text-[14px] outline-none"
              style={{ borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(28,64,68,0.12)", color: dark ? "#f9f7f2" : "#0f1f22" }}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] opacity-55" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
                {text.length} / 500
              </span>
              <button
                type="submit"
                disabled={submitting || text.trim().length === 0}
                className="inline-flex items-center gap-2 rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] font-medium text-[#0f1f22] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                {submitting ? "등록 중…" : "댓글 등록"}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border px-5 py-6 text-center" style={{ borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)" }}>
            <p className="text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}>
              댓글을 작성하려면 로그인이 필요합니다.
            </p>
            <button type="button" onClick={() => router.push("/login")} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
              로그인하기
            </button>
          </div>
        )}
        {mutationError ? <p role="alert" className="mt-3 text-[12px] text-[#ed5c48]">{mutationError}</p> : null}
      </div>

      <div className="mt-7 space-y-3">
        {currentState.status === "loading" ? (
          <CommentStatePanel>
            <Loader2 size={24} className="animate-spin text-[#7dd3a3]" />
            <p style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>댓글을 불러오는 중입니다.</p>
          </CommentStatePanel>
        ) : null}

        {currentState.status === "error" ? (
          <CommentStatePanel>
            <p style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>{currentState.error}</p>
            <button type="button" onClick={reload} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
              다시 시도
            </button>
          </CommentStatePanel>
        ) : null}

        {currentState.status === "success" && response?.content.length === 0 ? (
          <CommentStatePanel>
            <MessageCircle size={26} className="opacity-35" />
            <p style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>아직 작성된 댓글이 없습니다.</p>
          </CommentStatePanel>
        ) : null}

        {currentState.status === "success" && response ? response.content.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            deleting={deletingIds.has(comment.id)}
            onDelete={deleteComment}
          />
        )) : null}
      </div>

      {currentState.status === "success" && response && response.totalElements > 0 ? (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={response.page === 0}
            className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-[12px] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(28,64,68,0.15)", color: dark ? "#f9f7f2" : "#0f1f22" }}
          >
            <ChevronLeft size={14} /> 이전
          </button>
          <span className="min-w-16 text-center text-[12px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
            {response.page + 1} / {response.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={response.page + 1 >= response.totalPages}
            className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-[12px] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(28,64,68,0.15)", color: dark ? "#f9f7f2" : "#0f1f22" }}
          >
            다음 <ChevronRight size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

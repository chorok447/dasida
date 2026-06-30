"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MessageCircle, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import {
  fetchCampaignCommentPageLocation,
  updateCampaignComment,
  type CampaignComment,
  type CampaignCommentsResponse,
} from "@/data/campaigns";
import { ApiError, apiDeleteVoid, apiErrorMessage, apiGet, apiPost } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { useTheme } from "@/lib/theme-context";

type CommentListState = {
  identity: string;
  status: "loading" | "success" | "error";
  response: CampaignCommentsResponse | null;
  error: string;
};

type TargetLocationState = {
  identity: string;
  status: "loading" | "success" | "not-found" | "error";
  page: number | null;
  message: string;
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function CommentItem({
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
          : dark
            ? "rgba(255,255,255,0.08)"
            : "rgba(28,64,68,0.08)",
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
            <div className="flex flex-wrap items-center gap-1 text-[11px] opacity-55" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
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
                style={{ background: "rgba(125,211,163,0.14)", color: dark ? "#7dd3a3" : "#148a90" }}
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
        ) : null}
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
            style={{ borderColor: dark ? "rgba(255,255,255,0.14)" : "rgba(28,64,68,0.14)", color: dark ? "#f9f7f2" : "#0f1f22" }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] opacity-55" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              {editText.length} / 500
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="rounded-full px-4 py-2 text-[12px] disabled:opacity-40"
                style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)", color: dark ? "#f9f7f2" : "#0f1f22" }}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving || !editText.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#7dd3a3] px-4 py-2 text-[12px] text-[#0f1f22] disabled:opacity-40"
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
          style={{ color: dark ? "rgba(255,255,255,0.78)" : "rgba(28,64,68,0.82)" }}
        >
          {comment.text}
        </p>
      )}
    </article>
  );
}

export function CampaignComments({
  campaignId,
  targetCommentId,
}: {
  campaignId: string;
  targetCommentId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const savingCommentIdRef = useRef<string | null>(null);
  const editGenerationRef = useRef(0);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [editError, setEditError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const generationRef = useRef(0);
  const targetGenerationRef = useRef(0);
  const targetIdentity = JSON.stringify([campaignId, targetCommentId]);
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
  const requestIdentity = JSON.stringify([
    campaignId,
    token,
    page,
    retryTick,
    targetCommentId,
    targetResolution,
  ]);
  const [listState, setListState] = useState<CommentListState>({
    identity: "",
    status: "loading",
    response: null,
    error: "",
  });
  const currentState: CommentListState = listState.identity === requestIdentity
    ? listState
    : { identity: requestIdentity, status: "loading", response: null, error: "" };
  const currentStatus = currentState.status;
  const currentResponse = currentState.response;

  const clearTargetComment = () => {
    if (!targetCommentId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("commentId");
    const query = params.toString();
    router.replace(`/campaigns/${encodeURIComponent(campaignId)}${query ? `?${query}` : ""}`, { scroll: false });
  };

  const changePage = (nextPage: number) => {
    clearTargetComment();
    setPage(Math.max(0, nextPage));
  };

  useEffect(() => {
    if (!targetCommentId) return;
    const generation = ++targetGenerationRef.current;
    let cancelled = false;
    const isCurrent = () => !cancelled && generation === targetGenerationRef.current;

    fetchCampaignCommentPageLocation(campaignId, targetCommentId, 20)
      .then((location) => {
        if (!isCurrent()) return;
        setTargetLocationState({
          identity: targetIdentity,
          status: "success",
          page: location.page,
          message: "",
        });
        setPage(location.page);
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
        setPage(0);
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId, targetCommentId, targetIdentity]);

  useEffect(() => {
    if (targetLocationStatus === "loading") return;
    if (targetLocationPage !== undefined && targetLocationPage !== null && targetLocationPage !== page) return;
    const requestToken = token;
    if (getToken() !== requestToken) return;

    const generation = ++generationRef.current;
    let cancelled = false;
    const isCurrent = () =>
      !cancelled && generation === generationRef.current && getToken() === requestToken;

    apiGet<CampaignCommentsResponse>(
      `/api/campaigns/${campaignId}/comments?page=${page}&size=20`,
      requestToken,
    )
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
  }, [campaignId, page, requestIdentity, router, targetLocationPage, targetLocationStatus, token]);

  useEffect(() => {
    if (!targetCommentId || currentStatus !== "success") return;
    if (!currentResponse?.content.some((comment) => comment.id === targetCommentId)) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`comment-${targetCommentId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [currentResponse, currentStatus, targetCommentId]);

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
      clearTargetComment();
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
    clearTargetComment();
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

  const startEditing = (comment: CampaignComment) => {
    if (savingCommentIdRef.current) return;
    setMutationError("");
    setEditingCommentId(comment.id);
    setEditText(comment.text);
    setEditError("");
  };

  const cancelEditing = () => {
    if (savingCommentIdRef.current) return;
    editGenerationRef.current += 1;
    setEditingCommentId(null);
    setEditText("");
    setEditError("");
  };

  const saveEditing = async (comment: CampaignComment) => {
    if (savingCommentIdRef.current) return;
    const normalized = editText.trim();
    if (!normalized || normalized.length > 500) {
      setEditError("댓글은 1자 이상 500자 이하로 입력해주세요.");
      return;
    }
    const requestToken = getToken();
    if (!requestToken) {
      clearSession();
      setEditingCommentId(null);
      router.push("/login");
      return;
    }

    const generation = ++editGenerationRef.current;
    savingCommentIdRef.current = comment.id;
    setSavingCommentId(comment.id);
    setEditError("");
    try {
      const updated = await updateCampaignComment(
        campaignId,
        comment.id,
        { text: normalized },
        requestToken,
      );
      if (getToken() !== requestToken || generation !== editGenerationRef.current) return;
      if (!currentState.response?.content.some((item) => item.id === comment.id)) {
        setEditingCommentId(null);
        reload();
        return;
      }
      setListState((current) => current.identity === requestIdentity && current.response
        ? {
            ...current,
            response: {
              ...current.response,
              content: current.response.content.map((item) => item.id === comment.id ? updated : item),
            },
          }
        : current);
      setEditingCommentId(null);
      setEditText("");
    } catch (error) {
      if (getToken() !== requestToken || generation !== editGenerationRef.current) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        setEditingCommentId(null);
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 403) {
        setMutationError("댓글을 수정할 권한이 없습니다.");
        setEditingCommentId(null);
        reload();
      } else if (error instanceof ApiError && error.status === 404) {
        setMutationError("댓글을 찾을 수 없습니다.");
        setEditingCommentId(null);
        reload();
      } else if (error instanceof ApiError && error.status === 400) {
        setEditError(apiErrorMessage(error, "댓글 내용을 확인해주세요."));
      } else {
        setEditError("댓글 수정에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      if (savingCommentIdRef.current === comment.id) savingCommentIdRef.current = null;
      setSavingCommentId((current) => current === comment.id ? null : current);
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
              className="ui-control mt-2 resize-none bg-transparent px-3 py-3"
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
        {targetLocationMessage ? (
          <p role="alert" className="mt-3 text-[12px] text-[#ed5c48]">{targetLocationMessage}</p>
        ) : null}
      </div>

      <div className="mt-7 space-y-3">
        {currentState.status === "loading" ? (
          <StatePanel compact>
            <Loader2 size={24} className="animate-spin text-[#7dd3a3]" />
            <p style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>댓글을 불러오는 중입니다.</p>
          </StatePanel>
        ) : null}

        {currentState.status === "error" ? (
          <StatePanel compact role="alert">
            <p style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>{currentState.error}</p>
            <button type="button" onClick={reload} className="rounded-full bg-[#7dd3a3] px-5 py-2 text-[13px] text-[#0f1f22]">
              다시 시도
            </button>
          </StatePanel>
        ) : null}

        {currentState.status === "success" && response?.content.length === 0 ? (
          <StatePanel compact>
            <MessageCircle size={26} className="opacity-35" />
            <p style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>아직 작성된 댓글이 없습니다.</p>
          </StatePanel>
        ) : null}

        {currentState.status === "success" && response ? response.content.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            deleting={deletingIds.has(comment.id)}
            editing={editingCommentId === comment.id && comment.ownedByMe}
            saving={savingCommentId === comment.id}
            editText={editingCommentId === comment.id ? editText : comment.text}
            editError={editingCommentId === comment.id ? editError : ""}
            highlighted={comment.id === targetCommentId}
            onEdit={startEditing}
            onEditTextChange={setEditText}
            onSave={saveEditing}
            onCancel={cancelEditing}
            onDelete={deleteComment}
          />
        )) : null}
      </div>

      {currentState.status === "success" && response && response.totalElements > 0 ? (
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

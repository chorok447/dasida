"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiErrorMessage } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
import { beginAuthedRequest, clearSessionIfUnauthorized, staleByIdentity } from "@/lib/authed-request";
import { useAuthSession } from "@/lib/use-auth-session";
import { useCommentTargetScroll } from "@/lib/use-comment-target-scroll";
import { useConfirm } from "@/components/ui/confirm-dialog";

/** 게시글/캠페인 댓글 페이지 응답 공통 형태(백엔드 page envelope 와 1:1). */
export type PagedCommentsResponse<C> = {
  content: C[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

type ListState<C> = {
  identity: string;
  status: "loading" | "success" | "error";
  response: PagedCommentsResponse<C> | null;
  error: string;
};

type TargetLocationState = {
  identity: string;
  status: "loading" | "success" | "not-found" | "error";
  page: number | null;
  message: string;
};

export type UsePagedCommentsArgs<C extends { id: string; text: string }> = {
  /** postId 또는 campaignId. 요청 identity 의 기준. */
  scopeId: string;
  /** 현재 페이지(0-base). URL 이든 로컬 state 든 호출자가 소유한다. */
  page: number;
  targetCommentId: string | null;
  size?: number;
  maxLength?: number;
  fetchPage: (page: number, size: number) => Promise<PagedCommentsResponse<C>>;
  fetchTargetLocation: (commentId: string, size: number) => Promise<{ page: number }>;
  createComment: (text: string) => Promise<unknown>;
  updateComment: (commentId: string, text: string) => Promise<C>;
  removeComment: (commentId: string) => Promise<void>;
  /** 페이지 이동 반영. preserveTarget=false 면 target(commentId) 해제도 함께 처리해야 한다. */
  onPageChange: (page: number, opts: { replace: boolean; preserveTarget: boolean }) => void;
  /** 목록 404 시 보여줄 메시지("게시글을/캠페인을 찾을 수 없습니다."). */
  listNotFoundMessage: string;
  /** 등록/삭제/수정(권한·404) 오류 표출 채널 — toast 또는 인라인 state. */
  onMutationError: (message: string) => void;
  /** 새 mutation 시작 시 이전 인라인 오류 클리어(인라인 채널일 때만 필요). */
  onMutationErrorClear?: () => void;
  /** 목록 응답의 totalElements 를 부모 카운트에 반영(게시글 상세). */
  onTotalElements?: (total: number) => void;
  /** 등록(+1)/삭제(-1) 직후 낙관적 카운트 반영(게시글 상세). */
  onCountDelta?: (delta: number) => void;
  /** 등록/삭제 성공 후 부가 처리(캠페인: target 해제). */
  onAfterMutation?: () => void;
  /** 로그인 필요로 /login 이동 직전 안내(게시글: toast). */
  onRequireLogin?: () => void;
};

/**
 * 게시글·캠페인 댓글이 공유하는 상태머신:
 * 목록 fetch(identity 기반 stale 무시) + 빈 페이지 fallback,
 * target 댓글 위치 조회·스크롤, 등록/삭제(Confirm)/수정 mutation.
 * URL vs 로컬 페이지 상태, toast vs 인라인 오류 같은 화면별 차이는 콜백으로 위임한다.
 */
export function usePagedComments<C extends { id: string; text: string }>(args: UsePagedCommentsArgs<C>) {
  const { scopeId, page, targetCommentId } = args;
  const size = args.size ?? 20;
  const maxLength = args.maxLength ?? 500;

  const router = useRouter();
  const confirm = useConfirm();
  const { sessionId: token } = useAuthSession();

  // 콜백·fetcher 는 latest-ref 로 참조해 effect 재실행 조건에서 제외한다.
  const argsRef = useRef(args);
  useEffect(() => {
    argsRef.current = args;
  });

  const [reloadTick, setReloadTick] = useState(0);
  const listGenerationRef = useRef(0);
  const targetGenerationRef = useRef(0);

  const [composeText, setComposeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const deletingIdsRef = useRef(new Set<string>());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());

  const editGenerationRef = useRef(0);
  const savingCommentIdRef = useRef<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState("");
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);

  // target 댓글 위치 조회
  const targetIdentity = JSON.stringify([scopeId, targetCommentId]);
  const [targetLocationState, setTargetLocationState] = useState<TargetLocationState>({
    identity: "",
    status: "loading",
    page: null,
    message: "",
  });
  const currentTargetLocation: TargetLocationState | null = targetCommentId
    ? staleByIdentity(targetLocationState, targetIdentity, {
        identity: targetIdentity,
        status: "loading",
        page: null,
        message: "",
      })
    : null;
  const targetLocationStatus = currentTargetLocation?.status;
  const targetLocationPage = currentTargetLocation?.page;
  const targetResolution = currentTargetLocation
    ? `${currentTargetLocation.status}:${currentTargetLocation.page ?? ""}`
    : "none";

  useEffect(() => {
    if (!targetCommentId) return;
    const generation = ++targetGenerationRef.current;
    let cancelled = false;
    const isCurrent = () => !cancelled && generation === targetGenerationRef.current;

    argsRef.current.fetchTargetLocation(targetCommentId, size)
      .then((location) => {
        if (!isCurrent()) return;
        setTargetLocationState({
          identity: targetIdentity,
          status: "success",
          page: location.page,
          message: "",
        });
        if (location.page !== argsRef.current.page) {
          argsRef.current.onPageChange(location.page, { replace: true, preserveTarget: true });
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
        if (argsRef.current.page !== 0) {
          argsRef.current.onPageChange(0, { replace: true, preserveTarget: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [scopeId, size, targetCommentId, targetIdentity]);

  // 목록 fetch
  const requestIdentity = JSON.stringify([scopeId, token, page, reloadTick, targetCommentId, targetResolution]);
  const [listState, setListState] = useState<ListState<C>>({
    identity: "",
    status: "loading",
    response: null,
    error: "",
  });
  const currentState = staleByIdentity(listState, requestIdentity, {
    identity: requestIdentity,
    status: "loading",
    response: null,
    error: "",
  });

  useEffect(() => {
    if (targetLocationStatus === "loading") return;
    if (targetLocationPage !== undefined && targetLocationPage !== null && targetLocationPage !== page) return;
    const requestToken = token;
    if (getSessionId() !== requestToken) return;

    const guard = beginAuthedRequest(listGenerationRef, requestToken);

    argsRef.current.fetchPage(page, size)
      .then((response) => {
        if (!guard.isCurrent()) return;
        if (response.content.length === 0 && page > 0) {
          const previousPage = response.totalPages > 0
            ? Math.min(page - 1, response.totalPages - 1)
            : 0;
          argsRef.current.onPageChange(previousPage, { replace: true, preserveTarget: false });
          return;
        }
        argsRef.current.onTotalElements?.(response.totalElements);
        setListState({ identity: requestIdentity, status: "success", response, error: "" });
      })
      .catch((error) => {
        if (!guard.isCurrent()) return;
        if (clearSessionIfUnauthorized(error, requestToken)) {
          argsRef.current.onRequireLogin?.();
          router.push("/login");
          return;
        }
        setListState({
          identity: requestIdentity,
          status: "error",
          response: null,
          error: error instanceof ApiError && error.status === 404
            ? argsRef.current.listNotFoundMessage
            : "댓글을 불러오지 못했습니다.",
        });
      });

    return guard.cancel;
  }, [page, requestIdentity, router, size, targetLocationPage, targetLocationStatus, token]);

  useCommentTargetScroll(
    targetCommentId,
    currentState.status === "success",
    !!currentState.response?.content.some((comment) => comment.id === targetCommentId),
  );

  const reload = () => setReloadTick((tick) => tick + 1);

  const redirectToLogin = () => {
    argsRef.current.onRequireLogin?.();
    router.push("/login");
  };

  const submit = async () => {
    if (submittingRef.current) return;
    const requestToken = getSessionId();
    if (!requestToken) {
      redirectToLogin();
      return;
    }
    const normalized = composeText.trim();
    if (!normalized) return;
    if (normalized.length > maxLength) {
      argsRef.current.onMutationError(`댓글은 1자 이상 ${maxLength}자 이하로 입력해주세요.`);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    argsRef.current.onMutationErrorClear?.();
    try {
      await argsRef.current.createComment(normalized);
      if (getSessionId() !== requestToken) return;
      argsRef.current.onCountDelta?.(1);
      setComposeText("");
      argsRef.current.onAfterMutation?.();
      if (page === 0) reload();
      else argsRef.current.onPageChange(0, { replace: false, preserveTarget: false });
    } catch (error) {
      if (getSessionId() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        redirectToLogin();
      } else if (error instanceof ApiError && error.status === 400) {
        argsRef.current.onMutationError(apiErrorMessage(error, "댓글 내용을 확인해주세요."));
      } else if (error instanceof ApiError && error.status === 404) {
        argsRef.current.onMutationError(argsRef.current.listNotFoundMessage);
      } else {
        argsRef.current.onMutationError("댓글 등록에 실패했습니다.");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const refreshAfterRemove = () => {
    argsRef.current.onAfterMutation?.();
    const response = currentState.response;
    if (response && response.content.length === 1 && page > 0) {
      argsRef.current.onPageChange(page - 1, { replace: false, preserveTarget: false });
    } else {
      reload();
    }
  };

  const remove = async (commentId: string) => {
    if (deletingIdsRef.current.has(commentId)) return;
    const requestToken = getSessionId();
    if (!requestToken) {
      redirectToLogin();
      return;
    }
    if (!(await confirm({ message: "이 댓글을 삭제할까요?", destructive: true, confirmLabel: "삭제" }))) return;

    deletingIdsRef.current.add(commentId);
    setDeletingIds(new Set(deletingIdsRef.current));
    argsRef.current.onMutationErrorClear?.();
    try {
      await argsRef.current.removeComment(commentId);
      if (getSessionId() !== requestToken) return;
      argsRef.current.onCountDelta?.(-1);
      refreshAfterRemove();
    } catch (error) {
      if (getSessionId() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        redirectToLogin();
      } else if (error instanceof ApiError && error.status === 403) {
        argsRef.current.onMutationError("댓글 삭제 권한이 없습니다.");
      } else if (error instanceof ApiError && error.status === 404) {
        argsRef.current.onMutationError("이미 삭제되었거나 존재하지 않는 댓글입니다.");
        refreshAfterRemove();
      } else {
        argsRef.current.onMutationError("댓글 삭제에 실패했습니다.");
      }
    } finally {
      deletingIdsRef.current.delete(commentId);
      setDeletingIds(new Set(deletingIdsRef.current));
    }
  };

  const startEditing = (comment: C) => {
    if (savingCommentIdRef.current) return;
    argsRef.current.onMutationErrorClear?.();
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

  const saveEditing = async (commentId: string) => {
    if (savingCommentIdRef.current) return;
    const normalized = editText.trim();
    if (!normalized || normalized.length > maxLength) {
      setEditError(`댓글은 1자 이상 ${maxLength}자 이하로 입력해주세요.`);
      return;
    }
    const requestToken = getSessionId();
    if (!requestToken) {
      clearSession();
      setEditingCommentId(null);
      router.push("/login");
      return;
    }

    const generation = ++editGenerationRef.current;
    savingCommentIdRef.current = commentId;
    setSavingCommentId(commentId);
    setEditError("");
    try {
      const updated = await argsRef.current.updateComment(commentId, normalized);
      if (getSessionId() !== requestToken || generation !== editGenerationRef.current) return;
      if (!currentState.response?.content.some((comment) => comment.id === commentId)) {
        setEditingCommentId(null);
        reload();
        return;
      }
      setListState((current) => current.identity === requestIdentity && current.response
        ? {
            ...current,
            response: {
              ...current.response,
              content: current.response.content.map((comment) => comment.id === commentId ? updated : comment),
            },
          }
        : current);
      setEditingCommentId(null);
      setEditText("");
    } catch (error) {
      if (getSessionId() !== requestToken || generation !== editGenerationRef.current) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        setEditingCommentId(null);
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 403) {
        argsRef.current.onMutationError("댓글을 수정할 권한이 없습니다.");
        setEditingCommentId(null);
        reload();
      } else if (error instanceof ApiError && error.status === 404) {
        argsRef.current.onMutationError("댓글을 찾을 수 없습니다.");
        setEditingCommentId(null);
        reload();
      } else if (error instanceof ApiError && error.status === 400) {
        setEditError(apiErrorMessage(error, "댓글 내용을 확인해주세요."));
      } else {
        setEditError("댓글 수정에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      if (savingCommentIdRef.current === commentId) savingCommentIdRef.current = null;
      setSavingCommentId((current) => current === commentId ? null : current);
    }
  };

  return {
    token,
    status: currentState.status,
    response: currentState.response,
    listError: currentState.status === "error" ? currentState.error : "",
    reload,
    targetNotice: currentTargetLocation?.message ?? "",
    composeText,
    setComposeText,
    submitting,
    submit,
    deletingIds,
    remove,
    editingCommentId,
    editText,
    setEditText,
    editError,
    savingCommentId,
    startEditing,
    cancelEditing,
    saveEditing,
  };
}

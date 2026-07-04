import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSession } from "./auth";
import { ApiError } from "./api";
import {
  usePagedComments,
  type PagedCommentsResponse,
  type UsePagedCommentsArgs,
} from "./use-paged-comments";

const { pushMock, confirmMock, routerMock } = vi.hoisted(() => {
  const pushMock = vi.fn();
  // 실제 Next 라우터처럼 렌더 간 동일 참조여야 한다(effect deps 에 들어가므로).
  return { pushMock, confirmMock: vi.fn(), routerMock: { push: pushMock, replace: vi.fn() } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  useConfirm: () => confirmMock,
}));

type C = { id: string; text: string };

function pageResponse(
  content: C[],
  overrides: Partial<PagedCommentsResponse<C>> = {},
): PagedCommentsResponse<C> {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
    ...overrides,
  };
}

function makeArgs(overrides: Partial<UsePagedCommentsArgs<C>> = {}): UsePagedCommentsArgs<C> {
  return {
    scopeId: "42",
    page: 0,
    targetCommentId: null,
    fetchPage: vi.fn(async () => pageResponse([{ id: "c1", text: "첫 댓글" }])),
    fetchTargetLocation: vi.fn(async () => ({ page: 0 })),
    createComment: vi.fn(async () => ({})),
    updateComment: vi.fn(async (id: string, text: string) => ({ id, text })),
    removeComment: vi.fn(async () => {}),
    onPageChange: vi.fn(),
    listNotFoundMessage: "게시글을 찾을 수 없습니다.",
    onMutationError: vi.fn(),
    ...overrides,
  };
}

function renderPagedComments(args: UsePagedCommentsArgs<C>) {
  return renderHook((props: UsePagedCommentsArgs<C>) => usePagedComments(props), {
    initialProps: args,
  });
}

describe("usePagedComments", () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockReset();
    confirmMock.mockReset();
    confirmMock.mockResolvedValue(true);
  });

  describe("목록 fetch", () => {
    it("목록을 불러오면 success 상태와 totalElements 콜백을 반영한다", async () => {
      const onTotalElements = vi.fn();
      const args = makeArgs({ onTotalElements });
      const { result } = renderPagedComments(args);

      expect(result.current.status).toBe("loading");
      await waitFor(() => expect(result.current.status).toBe("success"));
      expect(args.fetchPage).toHaveBeenCalledWith(0, 20);
      expect(result.current.response?.content).toEqual([{ id: "c1", text: "첫 댓글" }]);
      expect(onTotalElements).toHaveBeenCalledWith(1);
    });

    it("page>0 에서 빈 응답이면 이전 페이지로 fallback 한다", async () => {
      const args = makeArgs({
        page: 2,
        fetchPage: vi.fn(async () => pageResponse([], { page: 2, totalElements: 20, totalPages: 2 })),
      });
      const { result } = renderPagedComments(args);

      await waitFor(() =>
        expect(args.onPageChange).toHaveBeenCalledWith(1, { replace: true, preserveTarget: false }),
      );
      // fallback 이동 중에는 success 로 내려앉지 않는다.
      expect(result.current.status).toBe("loading");
    });

    it("목록 404 는 listNotFoundMessage 를 노출한다", async () => {
      const args = makeArgs({
        fetchPage: vi.fn(async () => {
          throw new ApiError(404, "/api/posts/42/comments");
        }),
      });
      const { result } = renderPagedComments(args);

      await waitFor(() => expect(result.current.status).toBe("error"));
      expect(result.current.listError).toBe("게시글을 찾을 수 없습니다.");
    });

    it("목록 401 은 세션을 비우고 로그인으로 보낸다", async () => {
      setSession("홍길동");
      const onRequireLogin = vi.fn();
      const args = makeArgs({
        onRequireLogin,
        fetchPage: vi.fn(async () => {
          throw new ApiError(401, "/api/posts/42/comments");
        }),
      });
      renderPagedComments(args);

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
      expect(onRequireLogin).toHaveBeenCalled();
      expect(localStorage.getItem("dasida.session")).toBeNull();
    });
  });

  describe("target 댓글 위치", () => {
    it("target 이 다른 페이지에 있으면 그 페이지로 이동하고 목록 fetch 를 보류한다", async () => {
      const args = makeArgs({
        targetCommentId: "c9",
        fetchTargetLocation: vi.fn(async () => ({ page: 2 })),
      });
      const { rerender } = renderPagedComments(args);

      await waitFor(() =>
        expect(args.onPageChange).toHaveBeenCalledWith(2, { replace: true, preserveTarget: true }),
      );
      expect(args.fetchPage).not.toHaveBeenCalled();

      // 호출자가 페이지를 반영하면 그때 목록을 불러온다.
      rerender({ ...args, page: 2 });
      await waitFor(() => expect(args.fetchPage).toHaveBeenCalledWith(2, 20));
    });

    it("target 댓글이 없으면 안내 문구와 함께 0페이지로 돌아간다", async () => {
      const args = makeArgs({
        page: 3,
        targetCommentId: "c9",
        fetchTargetLocation: vi.fn(async () => {
          throw new ApiError(404, "/api/posts/42/comments/c9/location");
        }),
      });
      const { result } = renderPagedComments(args);

      await waitFor(() =>
        expect(args.onPageChange).toHaveBeenCalledWith(0, { replace: true, preserveTarget: true }),
      );
      expect(result.current.targetNotice).toBe("댓글을 찾을 수 없습니다.");
    });
  });

  describe("댓글 등록", () => {
    it("등록 성공 시 카운트 +1 후 첫 페이지를 다시 불러온다", async () => {
      setSession("홍길동");
      const onCountDelta = vi.fn();
      const args = makeArgs({ onCountDelta });
      const { result } = renderPagedComments(args);
      await waitFor(() => expect(result.current.status).toBe("success"));

      act(() => result.current.setComposeText("  새 댓글  "));
      await act(() => result.current.submit());

      expect(args.createComment).toHaveBeenCalledWith("새 댓글");
      expect(onCountDelta).toHaveBeenCalledWith(1);
      expect(result.current.composeText).toBe("");
      // page 0 이므로 reload — 목록을 한 번 더 불러온다.
      await waitFor(() => expect(args.fetchPage).toHaveBeenCalledTimes(2));
    });

    it("빈 댓글은 등록하지 않는다", async () => {
      setSession("홍길동");
      const args = makeArgs();
      const { result } = renderPagedComments(args);
      await waitFor(() => expect(result.current.status).toBe("success"));

      act(() => result.current.setComposeText("   "));
      await act(() => result.current.submit());

      expect(args.createComment).not.toHaveBeenCalled();
    });

    it("maxLength 초과면 onMutationError 를 호출하고 등록하지 않는다", async () => {
      setSession("홍길동");
      const args = makeArgs({ maxLength: 5 });
      const { result } = renderPagedComments(args);
      await waitFor(() => expect(result.current.status).toBe("success"));

      act(() => result.current.setComposeText("여섯글자짜리댓글"));
      await act(() => result.current.submit());

      expect(args.onMutationError).toHaveBeenCalledWith("댓글은 1자 이상 5자 이하로 입력해주세요.");
      expect(args.createComment).not.toHaveBeenCalled();
    });

    it("등록 401 이면 세션을 정리하고 로그인으로 보낸다", async () => {
      setSession("홍길동");
      const args = makeArgs({
        createComment: vi.fn(async () => {
          throw new ApiError(401, "/api/posts/42/comments");
        }),
      });
      const { result } = renderPagedComments(args);
      await waitFor(() => expect(result.current.status).toBe("success"));

      act(() => result.current.setComposeText("새 댓글"));
      await act(() => result.current.submit());

      expect(pushMock).toHaveBeenCalledWith("/login");
      expect(localStorage.getItem("dasida.session")).toBeNull();
    });
  });

  describe("댓글 삭제", () => {
    it("확인을 거부하면 삭제하지 않는다", async () => {
      setSession("홍길동");
      confirmMock.mockResolvedValue(false);
      const args = makeArgs();
      const { result } = renderPagedComments(args);
      await waitFor(() => expect(result.current.status).toBe("success"));

      await act(() => result.current.remove("c1"));

      expect(args.removeComment).not.toHaveBeenCalled();
    });

    it("페이지의 마지막 댓글을 삭제하면 이전 페이지로 이동한다", async () => {
      setSession("홍길동");
      const onCountDelta = vi.fn();
      const args = makeArgs({
        page: 1,
        onCountDelta,
        fetchPage: vi.fn(async () =>
          pageResponse([{ id: "c21", text: "마지막 댓글" }], { page: 1, totalElements: 21, totalPages: 2 }),
        ),
      });
      const { result } = renderPagedComments(args);
      await waitFor(() => expect(result.current.status).toBe("success"));

      await act(() => result.current.remove("c21"));

      expect(args.removeComment).toHaveBeenCalledWith("c21");
      expect(onCountDelta).toHaveBeenCalledWith(-1);
      expect(args.onPageChange).toHaveBeenCalledWith(0, { replace: false, preserveTarget: false });
    });

    it("삭제 404 는 안내 후 목록을 갱신한다", async () => {
      setSession("홍길동");
      const args = makeArgs({
        removeComment: vi.fn(async () => {
          throw new ApiError(404, "/api/posts/42/comments/c1");
        }),
      });
      const { result } = renderPagedComments(args);
      await waitFor(() => expect(result.current.status).toBe("success"));

      await act(() => result.current.remove("c1"));

      expect(args.onMutationError).toHaveBeenCalledWith("이미 삭제되었거나 존재하지 않는 댓글입니다.");
      // 이미 삭제된 댓글이므로 목록을 다시 불러온다.
      await waitFor(() => expect(args.fetchPage).toHaveBeenCalledTimes(2));
    });
  });

  describe("댓글 수정", () => {
    it("저장 성공 시 목록에서 해당 댓글만 교체한다", async () => {
      setSession("홍길동");
      const args = makeArgs({
        fetchPage: vi.fn(async () =>
          pageResponse([
            { id: "c1", text: "첫 댓글" },
            { id: "c2", text: "둘째 댓글" },
          ]),
        ),
      });
      const { result } = renderPagedComments(args);
      await waitFor(() => expect(result.current.status).toBe("success"));

      act(() => result.current.startEditing({ id: "c1", text: "첫 댓글" }));
      act(() => result.current.setEditText("수정된 댓글"));
      await act(() => result.current.saveEditing("c1"));

      expect(args.updateComment).toHaveBeenCalledWith("c1", "수정된 댓글");
      expect(result.current.editingCommentId).toBeNull();
      expect(result.current.response?.content).toEqual([
        { id: "c1", text: "수정된 댓글" },
        { id: "c2", text: "둘째 댓글" },
      ]);
      // 목록 재조회 없이 로컬 교체만 일어난다.
      expect(args.fetchPage).toHaveBeenCalledTimes(1);
    });

    it("수정 내용이 비어 있으면 editError 를 설정하고 저장하지 않는다", async () => {
      setSession("홍길동");
      const args = makeArgs();
      const { result } = renderPagedComments(args);
      await waitFor(() => expect(result.current.status).toBe("success"));

      act(() => result.current.startEditing({ id: "c1", text: "첫 댓글" }));
      act(() => result.current.setEditText("   "));
      await act(() => result.current.saveEditing("c1"));

      expect(result.current.editError).toBe("댓글은 1자 이상 500자 이하로 입력해주세요.");
      expect(args.updateComment).not.toHaveBeenCalled();
    });

    it("수정 403 은 안내 후 편집을 닫고 목록을 갱신한다", async () => {
      setSession("홍길동");
      const args = makeArgs({
        updateComment: vi.fn(async () => {
          throw new ApiError(403, "/api/posts/42/comments/c1");
        }),
      });
      const { result } = renderPagedComments(args);
      await waitFor(() => expect(result.current.status).toBe("success"));

      act(() => result.current.startEditing({ id: "c1", text: "첫 댓글" }));
      act(() => result.current.setEditText("수정된 댓글"));
      await act(() => result.current.saveEditing("c1"));

      expect(args.onMutationError).toHaveBeenCalledWith("댓글을 수정할 권한이 없습니다.");
      expect(result.current.editingCommentId).toBeNull();
      await waitFor(() => expect(args.fetchPage).toHaveBeenCalledTimes(2));
    });
  });
});

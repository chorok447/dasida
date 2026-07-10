import { richTextPlainLength } from "@/lib/rich-text-length";
import { mergeRichBodyForEditor, splitRichBodyHtml } from "@/lib/rich-body-html";
import { apiDelete, apiFetch, apiGet, apiPost, apiPut } from "@/lib/api";
import type { CommentPageLocationResponse } from "@/data/comments";

/** 백엔드 PostValidators 와 동일한 제한. */
export const POST_MAX_TEXT_LENGTH = 1000;
export const POST_MAX_TAGS = 10;
export const POST_MAX_TAG_LENGTH = 30;
export const POST_MAX_IMAGES = 4;

export type PostComposeValues = {
  text: string;
  images: string[];
  tags: string[];
  campaign: string;
};

export type PostComposePayload = {
  text: string;
  images: string[];
  tags: string[];
  campaignId: string | null;
};

export type PostComposeField = "text" | "images" | "tags";

export type PostComposeValidationResult =
  | { ok: true; payload: PostComposePayload }
  | { ok: false; message: string; field?: PostComposeField };

export function isValidPostImageUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

export function normalizePostTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)),
    ),
  );
}

export function normalizePostImages(images: string[]): string[] {
  return Array.from(new Set(images.map((url) => url.trim()).filter(Boolean)));
}

export function validatePostCompose(values: PostComposeValues): PostComposeValidationResult {
  const { html, images: inlineImages } = splitRichBodyHtml(values.text.trim());
  const plainLength = richTextPlainLength(html);
  if (plainLength === 0 && values.images.length === 0 && inlineImages.length === 0) {
    return { ok: false, message: "내용을 입력해주세요.", field: "text" };
  }
  if (plainLength > POST_MAX_TEXT_LENGTH) {
    return {
      ok: false,
      message: `내용은 ${POST_MAX_TEXT_LENGTH}자 이하여야 합니다.`,
      field: "text",
    };
  }

  const tags = normalizePostTags(values.tags);
  if (tags.length > POST_MAX_TAGS) {
    return {
      ok: false,
      message: `태그는 최대 ${POST_MAX_TAGS}개까지 가능합니다.`,
      field: "tags",
    };
  }
  if (tags.some((tag) => tag.length > POST_MAX_TAG_LENGTH)) {
    return {
      ok: false,
      message: `태그는 ${POST_MAX_TAG_LENGTH}자 이하여야 합니다.`,
      field: "tags",
    };
  }

  const images = normalizePostImages([...values.images, ...inlineImages]);
  if (images.length > POST_MAX_IMAGES) {
    return {
      ok: false,
      message: `이미지는 최대 ${POST_MAX_IMAGES}개까지 가능합니다.`,
      field: "images",
    };
  }
  if (images.some((url) => !isValidPostImageUrl(url))) {
    return {
      ok: false,
      message: "이미지 URL은 http:// 또는 https:// 로 시작해야 합니다.",
      field: "images",
    };
  }

  return {
    ok: true,
    payload: {
      text: html,
      images,
      tags,
      campaignId: values.campaign.trim() || null,
    },
  };
}

export function postToComposeValues(post: Post): PostComposeValues {
  return {
    text: mergeRichBodyForEditor(post.text, post.images),
    images: [],
    tags: post.tags,
    campaign: post.campaignId ?? "",
  };
}

export type PostSearchSort = "latest" | "popular" | "discussed" | "views";

export type Post = {
  id: string;
  author: { name: string; verified: boolean; profileImageUrl?: string | null };
  authorId?: number | null;
  time: string;
  text: string;
  tags: string[];
  images: string[];
  likes: number;
  comments: number;
  campaignId?: string;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  ownedByMe: boolean;
  /** 관리자 숨김 여부. 작성자 본인 경로(mine/상세)에서만 true 로 내려온다. */
  hidden?: boolean;
  /** 작성 시각(ISO). 시드 게시글은 null. */
  createdAt?: string | null;
  /** 조회수. 상세 진입 시 recordPostView 로 기록된다(작성자 본인 제외). */
  views?: number;
};

/**
 * 조회수 기록(fire-and-forget). 상세 진입 시 1회 호출하며, 실패해도 화면 흐름에 영향을 주지 않는다.
 * GET 에 섞지 않고 별도 POST 로 보내 SSR·목록 렌더가 조회수를 부풀리지 않게 한다.
 */
export function recordPostView(postId: string): void {
  void apiFetch(`/api/posts/${encodeURIComponent(postId)}/views`, { method: "POST" }).catch(() => {});
}

export type PostSearchResponse = {
  content: Post[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

// 마이페이지 게시글 pagination 응답(내 글/저장됨). 백엔드 PostPageResponse 와 1:1.
export type PostPageResponse = {
  content: Post[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

const MY_POSTS_PAGE_SIZE = 10;

function postsPage(path: string, page: number): Promise<PostPageResponse> {
  const params = new URLSearchParams({ page: String(page), size: String(MY_POSTS_PAGE_SIZE) });
  return apiGet<PostPageResponse>(`${path}?${params.toString()}`);
}

export const fetchMyPostsPage = (page: number) => postsPage("/api/posts/mine/page", page);
export const fetchBookmarkedPostsPage = (page: number) => postsPage("/api/posts/bookmarks/page", page);

// 게시글 댓글. 백엔드 GET/POST /api/posts/{id}/comments 응답과 1:1.
export type PostComment = {
  id: string;
  postId: string;
  author: { name: string; verified: boolean; profileImageUrl?: string | null };
  text: string;
  time: string;
  ownedByMe: boolean;
  edited: boolean;
  updatedAt: string | null;
  parentId?: string | null;
  replies?: PostComment[];
  likes?: number;
  likedByMe?: boolean;
};

/** 댓글 좋아요/취소 응답. 백엔드 CommentLikeStatusResponse 와 1:1. */
export type CommentLikeStatus = { likes: number; likedByMe: boolean };

export function likePostComment(postId: string, commentId: string): Promise<CommentLikeStatus> {
  return apiPost<CommentLikeStatus>(
    `/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/like`,
    {},
  );
}

export function unlikePostComment(postId: string, commentId: string): Promise<CommentLikeStatus> {
  return apiDelete<CommentLikeStatus>(
    `/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/like`,
  );
}

export type UpdatePostCommentRequest = { text: string };

export type PostCommentsPageResponse = {
  content: PostComment[];
  page: number;
  size: number;
  // pagination 은 최상위 댓글 기준, totalComments 는 답글 포함 전체 수.
  totalElements: number;
  totalPages: number;
  totalComments?: number;
};

export function fetchPostCommentsPage(
  postId: string,
  params: { page?: number; size?: number } = {},
): Promise<PostCommentsPageResponse> {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  });
  return apiGet<PostCommentsPageResponse>(
    `/api/posts/${encodeURIComponent(postId)}/comments/page?${query.toString()}`,
  );
}

export function fetchPostCommentPageLocation(
  postId: string,
  commentId: string,
  size = 20,
): Promise<CommentPageLocationResponse> {
  const query = new URLSearchParams({ size: String(size) });
  return apiGet<CommentPageLocationResponse>(
    `/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/page?${query.toString()}`,
  );
}

export function updatePostComment(
  postId: string,
  commentId: string,
  body: UpdatePostCommentRequest,
): Promise<PostComment> {
  return apiPut<PostComment>(
    `/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
    body,
  );
}

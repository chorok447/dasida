// 게시물 데이터는 백엔드(GET /api/posts)가 source of truth. 여기엔 타입 + 마이페이지 page fetcher.
import { apiGet } from "@/lib/api";

export type PostSearchSort = "latest" | "popular" | "discussed";

export type Post = {
  id: string;
  author: { name: string; verified: boolean };
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
};

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
  author: { name: string; verified: boolean };
  text: string;
  time: string;
  ownedByMe: boolean;
};

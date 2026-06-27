// 게시물 데이터는 백엔드(GET /api/posts)가 source of truth. 여기엔 타입만 유지.
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

// 게시글 댓글. 백엔드 GET/POST /api/posts/{id}/comments 응답과 1:1.
export type PostComment = {
  id: string;
  postId: string;
  author: { name: string; verified: boolean };
  text: string;
  time: string;
};

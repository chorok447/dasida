import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Post } from "@/data/posts";
import { PostResultCard } from "./search-result-cards";

const post: Post = {
  id: "post-1",
  authorId: 42,
  author: { name: "검색 작성자", verified: false, profileImageUrl: null },
  time: "방금 전",
  text: "검색 결과 게시글 본문",
  tags: ["#업사이클"],
  images: [],
  likes: 3,
  comments: 2,
  likedByMe: false,
  bookmarkedByMe: true,
  ownedByMe: false,
};

describe("PostResultCard", () => {
  it("작성자 프로필과 게시글 상세 링크를 함께 제공한다", () => {
    render(<PostResultCard post={post} />);

    expect(screen.getByRole("link", { name: /검색 작성자/ }).getAttribute("href")).toBe("/users/42");
    expect(screen.getByRole("link", { name: /검색 결과 게시글 본문/ }).getAttribute("href")).toBe("/posts/post-1");
  });
});

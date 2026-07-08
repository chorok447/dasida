import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MentionText } from "./mention-text";

describe("MentionText", () => {
  it("@멘션을 사용자 검색 링크로 렌더한다", () => {
    render(<MentionText text="@김철수 확인 부탁해요" />);
    const link = screen.getByRole("link", { name: "@김철수" });
    expect(link.getAttribute("href")).toBe(`/search?type=users&q=${encodeURIComponent("김철수")}`);
    expect(screen.getByText(/확인 부탁해요/)).toBeTruthy();
  });

  it("여러 멘션과 영문·특수문자 이름을 처리한다", () => {
    render(<MentionText text="@lee_01 그리고 @park.min 반가워요" />);
    expect(screen.getByRole("link", { name: "@lee_01" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "@park.min" })).toBeTruthy();
  });

  it("멘션이 없으면 텍스트만 렌더한다", () => {
    render(<MentionText text="일반 댓글입니다" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("일반 댓글입니다")).toBeTruthy();
  });
});

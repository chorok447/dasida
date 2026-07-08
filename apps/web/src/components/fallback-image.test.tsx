import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FallbackImage } from "./fallback-image";

describe("FallbackImage", () => {
  it("이미지를 alt와 함께 렌더한다", () => {
    render(<FallbackImage src="https://example.com/a.jpg" alt="캠페인 이미지" />);
    const img = screen.getByRole("img", { name: "캠페인 이미지" });
    expect(img).toHaveProperty("src", "https://example.com/a.jpg");
  });

  it("로드 실패 시 같은 이름의 대체 요소로 전환된다", () => {
    render(<FallbackImage src="https://example.com/broken.jpg" alt="캠페인 이미지" />);
    fireEvent.error(screen.getByRole("img"));

    expect(screen.queryByRole("img", { name: "캠페인 이미지" })).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });

  it("errorText가 있으면 실패 시 안내 문구를 보여준다", () => {
    render(
      <FallbackImage src="https://example.com/broken.jpg" alt="첨부 이미지" errorText="이미지를 불러올 수 없어요" />,
    );
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("이미지를 불러올 수 없어요")).toBeTruthy();
  });

  it("thumbnail이면 업로드 이미지는 썸네일 URL을 먼저 시도한다", () => {
    render(<FallbackImage src="http://localhost:8080/uploads/a.jpg" alt="게시글 이미지" thumbnail />);
    expect(screen.getByRole("img")).toHaveProperty("src", "http://localhost:8080/uploads/a.thumb.jpg");
  });

  it("thumbnail 로드 실패 시 원본으로, 원본도 실패하면 대체 요소로 전환된다", () => {
    render(<FallbackImage src="http://localhost:8080/uploads/a.webp" alt="게시글 이미지" thumbnail />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveProperty("src", "http://localhost:8080/uploads/a.webp");

    fireEvent.error(screen.getByRole("img"));
    expect(document.querySelector("img")).toBeNull();
    expect(screen.queryByRole("img", { name: "게시글 이미지" })).toBeTruthy();
  });

  it("thumbnail이어도 업로드 경로가 아니면 원본을 그대로 쓴다", () => {
    render(<FallbackImage src="https://images.unsplash.com/photo-1" alt="외부 이미지" thumbnail />);
    expect(screen.getByRole("img")).toHaveProperty("src", "https://images.unsplash.com/photo-1");
  });

  it("decorative면 실패한 대체 요소가 보조기기에 노출되지 않는다", () => {
    render(<FallbackImage src="https://example.com/broken.jpg" alt="" decorative />);
    fireEvent.error(document.querySelector("img")!);
    expect(document.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});

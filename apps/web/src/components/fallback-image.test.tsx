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

  it("decorative면 실패한 대체 요소가 보조기기에 노출되지 않는다", () => {
    render(<FallbackImage src="https://example.com/broken.jpg" alt="" decorative />);
    fireEvent.error(document.querySelector("img")!);
    expect(document.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});

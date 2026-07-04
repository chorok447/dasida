import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("src가 없으면 기본 아바타를 보여준다", () => {
    render(<Avatar name="홍길동" />);
    expect(document.querySelector("img")).toBeNull();
  });

  it("src가 있으면 프로필 이미지를 접근 가능한 이름과 함께 렌더한다", () => {
    render(<Avatar name="홍길동" src="https://example.com/me.jpg" />);
    expect(screen.getByRole("img", { name: "홍길동 프로필 이미지" })).toBeTruthy();
  });

  it("이미지 로드 실패 시 기본 아바타로 전환된다", () => {
    render(<Avatar name="홍길동" src="https://example.com/broken.jpg" />);
    fireEvent.error(screen.getByRole("img"));
    expect(document.querySelector("img")).toBeNull();
  });
});

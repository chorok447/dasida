import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageShell } from "./page-shell";

describe("PageShell", () => {
  it("자식을 렌더하고 페이지 그라데이션 배경을 적용한다", () => {
    render(
      <PageShell orb="none" paddingClassName="px-4 py-8">
        <h1>제목</h1>
      </PageShell>,
    );

    const section = screen.getByRole("heading", { name: "제목" }).closest("section");
    expect(section).toBeTruthy();
    expect(section?.style.backgroundImage).toBe("var(--page-gradient)");
  });

  it("orb가 none이 아니면 장식 orb 레이어를 렌더한다", () => {
    const { container } = render(
      <PageShell orb="left">
        <p>내용</p>
      </PageShell>,
    );

    expect(container.querySelector(".blur-\\[140px\\]")).toBeTruthy();
  });
});

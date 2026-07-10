import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineBanner } from "./offline-banner";

function setOnline(value: boolean) {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(value);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OfflineBanner", () => {
  it("온라인이면 아무것도 렌더하지 않는다", () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("오프라인이면 안내 배너를 보여주고 복구되면 감춘다", () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByRole("status").textContent).toContain("오프라인 상태예요");

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});

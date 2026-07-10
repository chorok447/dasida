import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSwipeX } from "./use-swipe";

function Harness({ onSwipeLeft, onSwipeRight }: { onSwipeLeft: () => void; onSwipeRight: () => void }) {
  const handlers = useSwipeX({ onSwipeLeft, onSwipeRight });
  return <div data-testid="area" {...handlers} />;
}

function swipe(el: Element, from: { x: number; y: number }, to: { x: number; y: number }) {
  fireEvent.touchStart(el, { touches: [{ clientX: from.x, clientY: from.y }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: to.x, clientY: to.y }] });
}

describe("useSwipeX", () => {
  it("왼쪽 스와이프는 onSwipeLeft만 발화한다", () => {
    const left = vi.fn();
    const right = vi.fn();
    render(<Harness onSwipeLeft={left} onSwipeRight={right} />);
    swipe(screen.getByTestId("area"), { x: 200, y: 100 }, { x: 100, y: 110 });
    expect(left).toHaveBeenCalledTimes(1);
    expect(right).not.toHaveBeenCalled();
  });

  it("오른쪽 스와이프는 onSwipeRight만 발화한다", () => {
    const left = vi.fn();
    const right = vi.fn();
    render(<Harness onSwipeLeft={left} onSwipeRight={right} />);
    swipe(screen.getByTestId("area"), { x: 100, y: 100 }, { x: 220, y: 90 });
    expect(right).toHaveBeenCalledTimes(1);
    expect(left).not.toHaveBeenCalled();
  });

  it("threshold 미만 이동은 무시한다", () => {
    const left = vi.fn();
    const right = vi.fn();
    render(<Harness onSwipeLeft={left} onSwipeRight={right} />);
    swipe(screen.getByTestId("area"), { x: 100, y: 100 }, { x: 130, y: 100 });
    expect(left).not.toHaveBeenCalled();
    expect(right).not.toHaveBeenCalled();
  });

  it("세로 이동이 더 크면(스크롤 의도) 발화하지 않는다", () => {
    const left = vi.fn();
    const right = vi.fn();
    render(<Harness onSwipeLeft={left} onSwipeRight={right} />);
    swipe(screen.getByTestId("area"), { x: 200, y: 100 }, { x: 120, y: 300 });
    expect(left).not.toHaveBeenCalled();
    expect(right).not.toHaveBeenCalled();
  });
});

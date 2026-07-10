import { render, screen, fireEvent } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ImageLightbox } from "./image-lightbox";

const IMAGES = ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"];

beforeAll(() => {
  // jsdom 의 <dialog> 는 showModal/close 를 지원하지만, 미지원 환경 대비 no-op 폴백.
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  }
});

describe("ImageLightbox", () => {
  it("현재 인덱스 이미지와 카운터를 보여준다", () => {
    render(
      <ImageLightbox images={IMAGES} index={1} altPrefix="게시글 이미지" onClose={() => {}} onIndexChange={() => {}} />,
    );
    const img = screen.getByRole("img", { name: "게시글 이미지 2" });
    expect(img).toHaveProperty("src", IMAGES[1]);
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("이전·다음 버튼이 인덱스를 순환시킨다", () => {
    const onIndexChange = vi.fn();
    render(
      <ImageLightbox images={IMAGES} index={0} altPrefix="게시글 이미지" onClose={() => {}} onIndexChange={onIndexChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "크게 보기 이전 사진" }));
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
    fireEvent.click(screen.getByRole("button", { name: "크게 보기 다음 사진" }));
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
  });

  it("좌우 화살표 키로 이동한다", () => {
    const onIndexChange = vi.fn();
    render(
      <ImageLightbox images={IMAGES} index={1} altPrefix="게시글 이미지" onClose={() => {}} onIndexChange={onIndexChange} />,
    );
    const dialog = screen.getByRole("dialog", { name: "이미지 크게 보기" });
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
  });

  it("닫기 버튼과 dialog cancel(Escape)이 onClose를 호출한다", () => {
    const onClose = vi.fn();
    render(
      <ImageLightbox images={IMAGES} index={0} altPrefix="게시글 이미지" onClose={onClose} onIndexChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "크게 보기 닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    const dialog = screen.getByRole("dialog", { name: "이미지 크게 보기" });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("이미지가 한 장이면 이동 버튼과 카운터를 렌더하지 않는다", () => {
    render(
      <ImageLightbox images={[IMAGES[0]]} index={0} altPrefix="게시글 이미지" onClose={() => {}} onIndexChange={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: "크게 보기 이전 사진" })).toBeNull();
    expect(screen.queryByText("1 / 1")).toBeNull();
  });

  it("열리는 동안 body 스크롤을 잠그고 닫히면 복원한다", () => {
    const { unmount } = render(
      <ImageLightbox images={IMAGES} index={0} altPrefix="게시글 이미지" onClose={() => {}} onIndexChange={() => {}} />,
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});

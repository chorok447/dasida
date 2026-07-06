import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PostComposeValues } from "@/data/posts";
import { PostComposeForm } from "./post-compose-form";

vi.mock("@/components/rich-text-editor", () => ({
  RichTextEditor: ({
    id,
    value,
    onChange,
    placeholder,
  }: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      id={id}
      aria-label={placeholder ?? "내용"}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  ),
}));

vi.mock("@/components/image-file-upload-button", () => ({
  ImageFileUploadButton: ({ disabled }: { disabled?: boolean }) => (
    <button type="button" disabled={disabled}>
      파일 업로드
    </button>
  ),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

const baseValues: PostComposeValues = {
  text: "업사이클 기록",
  images: [],
  tags: [],
  campaign: "",
};

describe("PostComposeForm", () => {
  it("이미지 URL을 추가하고 제거한다", () => {
    const onChange = vi.fn();
    const { rerender } = render(<PostComposeForm values={baseValues} onChange={onChange} campaigns={[]} />);

    fireEvent.change(screen.getByPlaceholderText("https://example.com/image.jpg"), {
      target: { value: "https://example.com/a.jpg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "이미지 URL 추가" }));

    expect(onChange).toHaveBeenCalledWith({
      ...baseValues,
      images: ["https://example.com/a.jpg"],
    });

    const valuesWithImage = { ...baseValues, images: ["https://example.com/a.jpg"] };
    rerender(<PostComposeForm values={valuesWithImage} onChange={onChange} campaigns={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "이미지 URL 제거: https://example.com/a.jpg" }));

    expect(onChange).toHaveBeenLastCalledWith({
      ...valuesWithImage,
      images: [],
    });
  });

  it("http(s)가 아닌 이미지 URL은 추가하지 않는다", () => {
    const onChange = vi.fn();
    render(<PostComposeForm values={baseValues} onChange={onChange} campaigns={[]} />);

    fireEvent.change(screen.getByPlaceholderText("https://example.com/image.jpg"), {
      target: { value: "ftp://example.com/a.jpg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "이미지 URL 추가" }));

    expect(screen.getByRole("alert").textContent).toBe("http:// 또는 https:// 로 시작하는 URL을 입력해주세요.");
    expect(onChange).not.toHaveBeenCalled();
  });
});

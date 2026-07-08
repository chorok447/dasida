import { describe, expect, it } from "vitest";
import { uploadThumbUrl } from "./upload-thumb";

describe("uploadThumbUrl", () => {
  it("업로드 이미지 URL을 .thumb.jpg 로 바꾼다", () => {
    expect(uploadThumbUrl("http://localhost:8080/uploads/abc-123.jpg")).toBe(
      "http://localhost:8080/uploads/abc-123.thumb.jpg",
    );
    expect(uploadThumbUrl("https://api.dasida.com/uploads/a.png")).toBe(
      "https://api.dasida.com/uploads/a.thumb.jpg",
    );
    expect(uploadThumbUrl("https://api.dasida.com/uploads/a.webp")).toBe(
      "https://api.dasida.com/uploads/a.thumb.jpg",
    );
  });

  it("업로드 경로가 아닌 URL은 그대로 반환한다", () => {
    expect(uploadThumbUrl("https://images.unsplash.com/photo-1?w=800")).toBe(
      "https://images.unsplash.com/photo-1?w=800",
    );
    expect(uploadThumbUrl("https://example.com/gallery/a.jpg")).toBe("https://example.com/gallery/a.jpg");
    expect(uploadThumbUrl("")).toBe("");
  });

  it("쿼리스트링이 붙은 업로드 URL은 변환하지 않는다", () => {
    expect(uploadThumbUrl("http://localhost:8080/uploads/a.jpg?v=2")).toBe(
      "http://localhost:8080/uploads/a.jpg?v=2",
    );
  });
});

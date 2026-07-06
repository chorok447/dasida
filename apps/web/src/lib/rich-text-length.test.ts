import { describe, expect, it } from "vitest";
import { richTextPlainPreview } from "@/lib/rich-text-length";

describe("richTextPlainPreview", () => {
  it("HTML 본문을 plain 으로 잘라 미리보기한다", () => {
    expect(richTextPlainPreview("<p>짧은 본문입니다</p>", 5)).toBe("짧은 본문…");
  });

  it("레거시 **굵게** 마크다운을 제거한다", () => {
    expect(richTextPlainPreview("**중요** 공지", 20)).toBe("중요 공지");
  });
});

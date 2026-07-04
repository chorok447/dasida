import { describe, expect, it } from "vitest";
import {
  cleanEmptyRichParagraphs,
  mergeRichBodyForEditor,
  splitRichBodyHtml,
} from "@/lib/rich-body-html";

describe("rich-body-html", () => {
  it("split 은 img src 를 분리한다", () => {
    const { html, images } = splitRichBodyHtml(
      '<p>소개</p><p><img src="https://a.com/1.jpg" alt="" /></p>',
    );
    expect(html).toBe("<p>소개</p>");
    expect(images).toEqual(["https://a.com/1.jpg"]);
  });

  it("merge 는 그리드 이미지를 편집 HTML 로 되돌린다", () => {
    const merged = mergeRichBodyForEditor("<p>소개</p>", ["https://a.com/1.jpg"]);
    expect(merged).toContain("https://a.com/1.jpg");
    expect(merged).toContain("소개");
  });

  it("cleanEmptyRichParagraphs 는 빈 p 를 제거한다", () => {
    expect(cleanEmptyRichParagraphs("<p>본문</p><p></p><p>&nbsp;</p>")).toBe("<p>본문</p>");
  });
});

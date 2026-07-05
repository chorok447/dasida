import { describe, expect, it } from "vitest";
import { richTextPlainLength } from "@/lib/rich-text-length";
import { isRichHtml, sanitizeRichHtml } from "@/lib/sanitize-rich-html";

describe("rich-text-length", () => {
  it("HTML 태그를 제외한 길이를 센다", () => {
    expect(richTextPlainLength("<p>안녕<strong>하세요</strong></p>")).toBe(5);
    expect(richTextPlainLength("plain")).toBe(5);
  });
});

describe("sanitize-rich-html", () => {
  it("허용 태그만 남긴다", () => {
    const out = sanitizeRichHtml('<p>hi</p><script>alert(1)</script><a href="https://x.com">link</a>');
    expect(out).toContain("<p>hi</p>");
    expect(out).not.toContain("script");
    expect(out).toContain('href="https://x.com"');
  });

  it("javascript 링크는 제거한다", () => {
    const out = sanitizeRichHtml('<a href="javascript:alert(1)">bad</a>');
    expect(out).not.toContain("javascript");
    expect(out).toContain("bad");
  });

  it("이미지 src 는 https 또는 로컬 개발 http(localhost)만 허용한다", () => {
    expect(sanitizeRichHtml('<p><img src="https://cdn.example.com/a.png" alt="a"></p>')).toContain("<img");
    expect(sanitizeRichHtml('<p><img src="http://localhost:8080/uploads/a.png" alt="a"></p>')).toContain("<img");
    expect(sanitizeRichHtml('<p><img src="http://127.0.0.1:8080/uploads/a.png" alt="a"></p>')).toContain("<img");
    expect(sanitizeRichHtml('<p><img src="http://tracker.example.com/a.png" alt="a"></p>')).not.toContain("<img");
  });

  it("isRichHtml 은 마크업 여부를 판별한다", () => {
    expect(isRichHtml("<p>x</p>")).toBe(true);
    expect(isRichHtml("**굵게**")).toBe(false);
  });
});

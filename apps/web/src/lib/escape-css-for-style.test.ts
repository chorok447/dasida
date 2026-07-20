import { describe, expect, it } from "vitest";
import { escapeCssForStyle } from "@/lib/escape-css-for-style";

describe("escape-css-for-style", () => {
  it("</style><script> 탈출 페이로드를 이스케이프한다", () => {
    const out = escapeCssForStyle(
      'body { content: "</style><script>alert(1)</script><style>"; }',
    );
    expect(out).not.toContain("</style");
    expect(out).toContain("<\\/style");
    expect(out).not.toContain("<script");
    expect(out).toContain("<\\script");
  });

  it("대소문자 변형(</STYLE, <SCRIPT)도 이스케이프한다", () => {
    const out = escapeCssForStyle("a { x: '</STYLE><SCRIPT>'; }");
    expect(out).not.toMatch(/<\/style/i);
    expect(out).not.toMatch(/<script/i);
  });

  it("<!-- 를 <\\!-- 로 바꾼다", () => {
    expect(escapeCssForStyle("a { x: '<!--'; }")).toContain("<\\!--");
  });

  it("NUL 문자를 제거한다", () => {
    expect(escapeCssForStyle("a\0b")).toBe("ab");
  });

  it("일반 CSS 는 그대로 둔다", () => {
    const css = "body { color: red; }";
    expect(escapeCssForStyle(css)).toBe(css);
  });

  it("빈 문자열은 빈 문자열", () => {
    expect(escapeCssForStyle("")).toBe("");
  });
});

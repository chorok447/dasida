import { describe, expect, it } from "vitest";
import { validatePostCompose } from "@/data/posts";

describe("validatePostCompose", () => {
  const base = { text: "업사이클 기록", images: [], tags: [], campaign: "" };

  it("rejects empty text", () => {
    const result = validatePostCompose({ ...base, text: "  " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("text");
  });

  it("accepts valid payload", () => {
    const result = validatePostCompose(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.text).toBe("업사이클 기록");
      expect(result.payload.campaignId).toBeNull();
    }
  });

  it("moves inline images from text to images array", () => {
    const result = validatePostCompose({
      ...base,
      text: '<p>본문</p><p><img src="https://a.com/x.jpg" alt="" /></p>',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.text).toBe("<p>본문</p>");
      expect(result.payload.images).toEqual(["https://a.com/x.jpg"]);
    }
  });

  it("rejects too many tags", () => {
    const tags = Array.from({ length: 11 }, (_, i) => `#tag${i}`);
    const result = validatePostCompose({ ...base, tags });
    expect(result.ok).toBe(false);
  });
});

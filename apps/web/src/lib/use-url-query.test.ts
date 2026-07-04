import { describe, expect, it } from "vitest";
import { parsePageParam } from "./use-url-query";

describe("parsePageParam", () => {
  it("returns 0 for null", () => {
    expect(parsePageParam(null)).toBe(0);
  });

  it("parses valid non-negative integers", () => {
    expect(parsePageParam("0")).toBe(0);
    expect(parsePageParam("3")).toBe(3);
  });

  it("falls back to 0 for invalid values", () => {
    expect(parsePageParam("-1")).toBe(0);
    expect(parsePageParam("1.5")).toBe(0);
    expect(parsePageParam("abc")).toBe(0);
  });
});

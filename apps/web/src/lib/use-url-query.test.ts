import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildFeedHref, parsePageParam, useCanonicalUrl } from "./use-url-query";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

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

describe("buildFeedHref", () => {
  it("기본값이면 sort와 page만 포함한다", () => {
    expect(buildFeedHref({ query: "", campaignOnly: false, sort: "latest", page: 0 })).toBe(
      "/feed?sort=latest&page=0",
    );
  });

  it("검색어와 필터를 반영한다", () => {
    expect(
      buildFeedHref({ query: "업사이클", campaignOnly: true, sort: "popular", page: 2 }),
    ).toBe("/feed?q=%EC%97%85%EC%82%AC%EC%9D%B4%ED%81%B4&campaignOnly=true&sort=popular&page=2");
  });
});

describe("useCanonicalUrl", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("current와 canonical이 다르면 replace 한다", () => {
    renderHook(() => useCanonicalUrl("/feed?sort=latest&page=0", "/feed"));
    expect(replace).toHaveBeenCalledWith("/feed?sort=latest&page=0", { scroll: false });
  });

  it("같으면 replace 하지 않는다", () => {
    renderHook(() => useCanonicalUrl("/feed?sort=latest&page=0", "/feed?sort=latest&page=0"));
    expect(replace).not.toHaveBeenCalled();
  });
});

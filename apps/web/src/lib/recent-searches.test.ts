// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRecentSearches,
  getRecentSearches,
  recordRecentSearch,
  removeRecentSearch,
} from "./recent-searches";

describe("recent-searches", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearRecentSearches();
  });

  it("최신 검색어가 맨 앞에 오고 8개까지만 유지한다", () => {
    for (let i = 1; i <= 10; i++) recordRecentSearch(`검색어${i}`);
    const items = getRecentSearches();
    expect(items).toHaveLength(8);
    expect(items[0]).toBe("검색어10");
    expect(items).not.toContain("검색어1");
  });

  it("대소문자만 다른 중복은 최신 표기로 갱신된다", () => {
    recordRecentSearch("Upcycle");
    recordRecentSearch("다른것");
    recordRecentSearch("upcycle");
    expect(getRecentSearches()).toEqual(["upcycle", "다른것"]);
  });

  it("공백 검색어는 기록하지 않는다", () => {
    recordRecentSearch("   ");
    expect(getRecentSearches()).toEqual([]);
  });

  it("개별 삭제와 전체 삭제가 동작하고 localStorage 에 지속된다", () => {
    recordRecentSearch("하나");
    recordRecentSearch("둘");
    removeRecentSearch("하나");
    expect(getRecentSearches()).toEqual(["둘"]);
    expect(JSON.parse(window.localStorage.getItem("dasida_recent_searches") ?? "[]")).toEqual(["둘"]);
    clearRecentSearches();
    expect(getRecentSearches()).toEqual([]);
  });
});

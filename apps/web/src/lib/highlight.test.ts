import { describe, expect, it } from "vitest";
import { splitByQuery } from "./highlight";

describe("splitByQuery", () => {
  it("대소문자를 무시하고 일치 구간을 분리한다", () => {
    expect(splitByQuery("Upcycle 업사이클 upcycle", "upcycle")).toEqual([
      { text: "Upcycle", hit: true },
      { text: " 업사이클 ", hit: false },
      { text: "upcycle", hit: true },
    ]);
  });

  it("공백으로 구분된 여러 단어를 각각 강조한다", () => {
    expect(splitByQuery("페트병으로 화분 만들기", "페트병 화분")).toEqual([
      { text: "페트병", hit: true },
      { text: "으로 ", hit: false },
      { text: "화분", hit: true },
      { text: " 만들기", hit: false },
    ]);
  });

  it("정규식 특수문자 검색어를 리터럴로 취급한다", () => {
    expect(splitByQuery("c++ 업사이클", "c++")).toEqual([
      { text: "c++", hit: true },
      { text: " 업사이클", hit: false },
    ]);
  });

  it("빈 검색어·비매치면 전체를 비매치 청크 하나로 돌려준다", () => {
    expect(splitByQuery("본문", "")).toEqual([{ text: "본문", hit: false }]);
    expect(splitByQuery("본문", "없는말")).toEqual([{ text: "본문", hit: false }]);
  });
});

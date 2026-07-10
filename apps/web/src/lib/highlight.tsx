import type { CSSProperties, ReactNode } from "react";

export type HighlightChunk = { text: string; hit: boolean };

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

/**
 * 검색어(공백 구분 다중 단어, 대소문자 무시)와 일치하는 구간을 분리한다.
 * 정규식 특수문자가 든 검색어("c++")도 리터럴로 취급한다. 빈 검색어면 전체를 비매치 1개로.
 */
export function splitByQuery(text: string, query: string): HighlightChunk[] {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => term.replace(REGEX_SPECIALS, "\\$&"));
  if (text.length === 0 || terms.length === 0) return [{ text, hit: false }];
  const splitter = new RegExp(`(${terms.join("|")})`, "gi");
  // 캡처 그룹 split 은 매치된 구간을 그대로 배열에 남기므로, anchored 재검사로 hit 를 판정한다.
  const matcher = new RegExp(`^(?:${terms.join("|")})$`, "i");
  return text
    .split(splitter)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, hit: matcher.test(part) }));
}

const markStyle: CSSProperties = {
  background: "var(--accent-soft)",
  color: "inherit",
  borderRadius: 3,
  padding: "0 1px",
};

/** 텍스트에서 검색어 일치 구간을 <mark> 로 강조해 렌더한다. */
export function HighlightedText({ text, query }: { text: string; query: string }): ReactNode {
  const chunks = splitByQuery(text, query);
  if (!chunks.some((chunk) => chunk.hit)) return text;
  return chunks.map((chunk, index) =>
    chunk.hit ? (
      <mark key={index} style={markStyle}>
        {chunk.text}
      </mark>
    ) : (
      <span key={index}>{chunk.text}</span>
    ),
  );
}

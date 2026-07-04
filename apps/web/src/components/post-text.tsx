"use client";

import type { CSSProperties, ReactNode } from "react";
import { isRichHtml, sanitizeRichHtml } from "@/lib/sanitize-rich-html";

const BOLD_RE = /\*\*([^*]+)\*\*/g;

/** 게시글·캠페인 본문 — HTML(리치) 또는 레거시 plain/markdown. */
export function PostText({
  text,
  className = "",
  style,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
}) {
  if (isRichHtml(text)) {
    const safe = sanitizeRichHtml(text);
    return (
      <div
        className={`rich-text-body break-words ${className}`.trim()}
        style={style}
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    );
  }

  const lines = text.split("\n");

  return (
    <div className={`whitespace-pre-wrap break-words ${className}`.trim()} style={style}>
      {lines.map((line, lineIndex) => (
        <span key={lineIndex}>
          {lineIndex > 0 ? "\n" : null}
          {formatBold(line)}
        </span>
      ))}
    </div>
  );
}

function formatBold(line: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(BOLD_RE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(line.slice(last, index));
    parts.push(<strong key={`${index}-${match[1]}`}>{match[1]}</strong>);
    last = index + match[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts.length > 0 ? parts : [line];
}

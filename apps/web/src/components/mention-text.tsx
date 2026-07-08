import Link from "next/link";
import type { ReactNode } from "react";

/** 서버 CommentMentionNotifier 와 같은 토큰 규칙(@ 뒤 한글·영숫자·._-). */
const MENTION_RE = /@([\p{L}\p{N}._-]+)/gu;

/**
 * 댓글 텍스트의 @멘션을 사용자 검색 링크로 렌더한다.
 * 서버가 어떤 이름으로 해석했는지는 알 수 없으므로 토큰 전체를 사용자 탭 검색으로 잇는다.
 */
export function MentionText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION_RE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    parts.push(
      <Link
        key={index}
        href={`/search?type=users&q=${encodeURIComponent(match[1])}`}
        className="font-medium hover:underline"
        style={{ color: "var(--accent-secondary)" }}
      >
        {match[0]}
      </Link>,
    );
    last = index + match[0].length;
  }
  if (parts.length === 0) return <>{text}</>;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

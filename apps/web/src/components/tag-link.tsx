import Link from "next/link";
import type { CSSProperties } from "react";

/** 게시글 태그 → 태그 모아보기(검색 페이지 tag 필터) 링크. */
export function TagLink({ tag, className, style }: { tag: string; className?: string; style?: CSSProperties }) {
  return (
    <Link
      href={`/search?type=posts&tag=${encodeURIComponent(tag)}`}
      className={className}
      style={style}
      aria-label={`${tag} 태그 게시글 보기`}
    >
      {tag}
    </Link>
  );
}

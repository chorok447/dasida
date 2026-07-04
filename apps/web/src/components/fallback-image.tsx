"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";

type FallbackImageProps = {
  src: string;
  alt: string;
  className?: string;
  errorText?: string;
  /** @deprecated 대체 UI 색상이 CSS 토큰으로 바뀌어 더 이상 사용하지 않는다. 호출부 정리 후 제거 예정. */
  dark?: boolean;
  decorative?: boolean;
};

export function FallbackImage({
  src,
  alt,
  className = "",
  errorText,
  decorative = false,
}: FallbackImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    const label = errorText ?? alt;
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-center${errorText ? " text-[11px]" : ""}`}
        // 배경은 양 테마에서 은은한 틴트가 필요해 반투명 토큰(--border)을 그대로 쓴다.
        style={{ background: "var(--border)" }}
        role="img"
        aria-label={label || undefined}
        aria-hidden={decorative && !errorText ? true : undefined}
      >
        <ImageIcon
          size={errorText ? 20 : 24}
          style={{ color: "var(--foreground)", opacity: 0.35 }}
          aria-hidden
        />
        {errorText ? (
          <span style={{ color: "var(--foreground)", opacity: 0.5 }}>{errorText}</span>
        ) : null}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      aria-hidden={decorative || undefined}
    />
  );
}

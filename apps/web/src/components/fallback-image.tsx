"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { uploadThumbUrl } from "@/lib/upload-thumb";

type FallbackImageProps = {
  src: string;
  alt: string;
  className?: string;
  errorText?: string;
  decorative?: boolean;
  /** 목록 화면용. 업로드 이미지면 썸네일(`.thumb.jpg`)을 먼저 시도하고 없으면 원본으로 fallback 한다. */
  thumbnail?: boolean;
  /** 첫 화면(LCP) 이미지용. 기본은 lazy 로딩이므로 히어로·상세 헤더 이미지에만 켠다. */
  priority?: boolean;
};

export function FallbackImage({
  src,
  alt,
  className = "",
  errorText,
  decorative = false,
  thumbnail = false,
  priority = false,
}: FallbackImageProps) {
  const [failed, setFailed] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  // 빈/누락 src 는 <img src=""> 가 되어 브라우저가 onError 를 발생시키지 않아(문서 URL 로 해석)
  // aspect 박스만 남고 placeholder 가 뜨지 않는다. 선택형 이미지(예: 썸네일 없는 캠페인)를
  // 위해 빈 src 를 실패와 동일하게 취급한다.
  const hasSrc = typeof src === "string" && src.trim().length > 0;
  const thumbSrc = thumbnail ? uploadThumbUrl(src) : src;
  const useThumb = thumbnail && !thumbFailed && thumbSrc !== src;
  const currentSrc = useThumb ? thumbSrc : src;

  if (failed || !hasSrc) {
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
      src={currentSrc}
      alt={alt}
      className={className}
      loading={priority ? undefined : "lazy"}
      decoding="async"
      onError={() => (useThumb ? setThumbFailed(true) : setFailed(true))}
      aria-hidden={decorative || undefined}
    />
  );
}

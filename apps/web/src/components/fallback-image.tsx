"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";

type FallbackImageProps = {
  src: string;
  alt: string;
  className?: string;
  errorText?: string;
  dark?: boolean;
  decorative?: boolean;
};

export function FallbackImage({
  src,
  alt,
  className = "",
  errorText,
  dark = false,
  decorative = false,
}: FallbackImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    const label = errorText ?? alt;
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-center${errorText ? " text-[11px]" : ""}`}
        style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}
        role="img"
        aria-label={label || undefined}
        aria-hidden={decorative && !errorText ? true : undefined}
      >
        <ImageIcon
          size={errorText ? 20 : 24}
          style={{ color: dark ? "rgba(255,255,255,0.35)" : "rgba(28,64,68,0.35)" }}
          aria-hidden
        />
        {errorText ? (
          <span style={{ color: dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}>{errorText}</span>
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

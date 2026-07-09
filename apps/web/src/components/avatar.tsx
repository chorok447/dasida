"use client";

import { useState } from "react";
import { Leaf, User } from "lucide-react";
import { uploadThumbUrl } from "@/lib/upload-thumb";

type AvatarProps = {
  name: string;
  verified?: boolean;
  size?: number;
  src?: string;
};

function DefaultAvatar({ size }: { size: number }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-full"
      style={{ background: "rgba(var(--ink-rgb), 0.12)" }}
      aria-hidden
    >
      <User
        size={Math.round(size * 0.52)}
        color={"rgba(var(--ink-rgb), 0.4)"}
        strokeWidth={1.75}
      />
    </div>
  );
}

export function Avatar({ name, verified, size = 32, src }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const showDefault = !src || failed;

  // 업로드 프로필 이미지는 작은 썸네일을 먼저 시도하고, 없으면(과거 업로드·webp) 원본으로 fallback.
  const thumbSrc = src ? uploadThumbUrl(src) : undefined;
  const useThumb = Boolean(thumbSrc && thumbSrc !== src && !thumbFailed);
  const currentSrc = useThumb ? thumbSrc : src;

  return (
    <div className="relative inline-block flex-shrink-0" style={{ width: size, height: size }}>
      {showDefault ? (
        <DefaultAvatar size={size} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentSrc}
          alt={`${name} 프로필 이미지`}
          loading="lazy"
          decoding="async"
          onError={() => (useThumb ? setThumbFailed(true) : setFailed(true))}
          className="h-full w-full rounded-full object-cover"
          draggable={false}
        />
      )}
      {verified && (
        <div
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-[#7dd3a3] ring-1 ring-white"
          style={{ width: Math.max(12, size * 0.42), height: Math.max(12, size * 0.42) }}
        >
          <Leaf size={Math.max(7, size * 0.24)} color="#0f1f22" />
        </div>
      )}
    </div>
  );
}

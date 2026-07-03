"use client";

import { useState } from "react";
import { Leaf, User } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

type AvatarProps = {
  name: string;
  verified?: boolean;
  size?: number;
  src?: string;
};

function DefaultAvatar({ size, dark }: { size: number; dark: boolean }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-full"
      style={{ background: dark ? "#363636" : "#EFEFEF" }}
      aria-hidden
    >
      <User
        size={Math.round(size * 0.52)}
        color={dark ? "#737373" : "#A8A8A8"}
        strokeWidth={1.75}
      />
    </div>
  );
}

export function Avatar({ name, verified, size = 32, src }: AvatarProps) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [failed, setFailed] = useState(false);
  const showDefault = !src || failed;

  return (
    <div className="relative inline-block flex-shrink-0" style={{ width: size, height: size }}>
      {showDefault ? (
        <DefaultAvatar size={size} dark={dark} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${name} 프로필 이미지`}
          onError={() => setFailed(true)}
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

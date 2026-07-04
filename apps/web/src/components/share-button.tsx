"use client";

import type { ButtonHTMLAttributes } from "react";
import { Share2 } from "lucide-react";
import { sharePage } from "@/lib/share";

type ShareButtonProps = {
  title: string;
  text?: string;
  url?: string;
  size?: number;
  label?: string;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "style">;

export function ShareButton({
  title,
  text,
  url,
  className = "",
  style,
  size = 14,
  label = "공유하기",
}: ShareButtonProps) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-label={label}
      onClick={() => void sharePage({ title, text, url })}
    >
      <Share2 size={size} aria-hidden />
    </button>
  );
}

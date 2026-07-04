"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { uploadMedia, uploadMediaErrorMessage } from "@/lib/upload-media";

const ACCEPT = "image/jpeg,image/png,image/webp";

export function ImageFileUploadButton({
  onUploaded,
  disabled,
  label = "파일 업로드",
  className,
}: {
  onUploaded: (url: string) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError("");
    try {
      const url = await uploadMedia(file);
      onUploaded(url);
    } catch (pickError) {
      setError(uploadMediaErrorMessage(pickError, "이미지 업로드에 실패했습니다."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => void onPick(event)}
        disabled={disabled || uploading}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-medium disabled:opacity-40"
        style={{ background: "var(--border)", color: "var(--foreground)" }}
      >
        {uploading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <ImageIcon size={14} aria-hidden />}
        {uploading ? "업로드 중…" : label}
      </button>
      {error ? <p className="mt-1.5 text-[12px] text-red-500" role="alert">{error}</p> : null}
    </div>
  );
}
